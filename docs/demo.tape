Output docs/demo.gif
Set Shell "bash"
Set FontSize 17
Set Width 1100
Set Height 860
Set Theme "Catppuccin Mocha"
Set TypingSpeed 30ms
Set Padding 18
Hide
Type "export PS1='$ '; clear"
Enter
Sleep 500ms
Show
Type "node bin/lintpreflight.mjs --target 10 .demo/before"
Enter
Sleep 7s
Type "node bin/lintpreflight.mjs --target 10 .demo/after"
Enter
Sleep 6s
