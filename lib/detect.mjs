import { parse } from 'acorn';
import { migration } from './eslint10.mjs';

export function detect(source) {
  let ast;
  const options = { ecmaVersion: 'latest', locations: true, allowHashBang: true };
  try {
    ast = parse(source, { ...options, sourceType: 'module' });
  } catch {
    ast = parse(source, { ...options, sourceType: 'script', allowReturnOutsideFunction: true });
  }
  const findings = [];
  const stack = [[ast, null]];
  while (stack.length) {
    const [node, parent] = stack.pop();
    let name;
    let receiver;
    let kind;
    if (node.type === 'MemberExpression') {
      name = node.computed ? node.property.type === 'Literal' && node.property.value : node.property.name;
      receiver = source.slice(node.object.start, node.object.end);
      kind = parent?.type === 'CallExpression' && parent.callee === node ? 'call' : 'member-reference';
    } else if (node.type === 'Property' && parent?.type === 'ObjectPattern') {
      name = node.computed ? node.key.type === 'Literal' && node.key.value : node.key.name ?? node.key.value;
      receiver = 'destructured binding';
      kind = 'destructuring';
    }
    if (typeof name === 'string' && Object.hasOwn(migration.members, name)) {
      const [owner, replacement] = migration.members[name];
      findings.push({ line: node.loc.start.line, column: node.loc.start.column + 1, api: `${owner}.${name}`, replacement, receiver: receiver.slice(0, 120), kind, confidence: 'candidate' });
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        for (const child of value) if (child?.type) stack.push([child, node]);
      } else if (value?.type) stack.push([value, node]);
    }
  }
  return findings.sort((a, b) => a.line - b.line || a.column - b.column);
}
