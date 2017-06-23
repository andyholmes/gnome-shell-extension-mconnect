# Change these to modify how installation is performed
topextensiondir = $(datadir)/gnome-shell/extensions

gschemabase = org.gnome.shell.extensions

extension_id = mconnect
extensionurl = https://github.com/andyholmes/gnome-shell-extension-mconnect
uuid = $(extension_id)@andyholmes.github.io
gschemaname = $(gschemabase).$(extension_id)

extensiondir = $(topextensiondir)/$(uuid)
localextensiondir = $(HOME)/.local/share/gnome-shell/extensions/$(uuid)

