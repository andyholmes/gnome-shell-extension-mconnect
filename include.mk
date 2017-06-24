#
extension_id = mconnect
extension_version = 0.1
shell_version = \"3.24\", \"3.24.1\", \"3.24.2\"
extensionurl = https://github.com/andyholmes/gnome-shell-extension-$(extension_id)
uuid = $(extension_id)@andyholmes.github.io
gschema_name = org.gnome.shell.extensions.$(extension_id)

# these cause hell if you rename them
extensiondir = $(datadir)/gnome-shell/extensions/$(uuid)
localextensiondir = $(HOME)/.local/share/gnome-shell/extensions/$(uuid)

