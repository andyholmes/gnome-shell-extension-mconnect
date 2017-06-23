# Change these to modify how installation is performed
topextensiondir = $(datadir)/gnome-shell/extensions
extensionbase = @gnome-shell-extensions.gcampax.github.com

gschemabase = org.gnome.shell.extensions

extensionname = mconnect
extensionurl = https://github.com/andyholmes/gnome-shell-extension-mconnect
uuid = $(extensionname)@andyholmes.github.io
gschemaname = $(gschemabase).$(extensionname)

extensiondir = $(topextensiondir)/$(uuid)
localextensiondir = $(HOME)/.local/share/gnome-shell/extensions/$(uuid)

