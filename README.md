# MConnect integration for Gnome Shell 3.24.1+
This extension (will, as it and mconnect mature) provide integration for
mconnect into Gnome Shell, in the most native way possible.

[mconnect](https://github.com/bboozzoo/mconnect) is a KDE Connect protocol implementation in Vala/C.

## Installation

### mconnect

As of June 5, 2017, this extension currently relies on the [dbus-support](https://github.com/bboozzoo/mconnect/tree/bboozzoo/dbus-support)
branch(es) of mconnect. First build mconnect (see repository for dependencies):

    git clone https://github.com/bboozzoo/mconnect.git --branch bboozzoo/dbus-support
    cd mconnect
    autoreconf -if 
    ./configure --prefix=/usr
    make
    
Then simply run:

    ./mconnect -d

    
### Extension

The extension will not appear on the extension website until reasonably
complete and useful. To follow along now you may:

    git clone https://github.com/andyholmes/gnome-shell-extension-mconnect.git
    ln -sf gnome-shell-extension-mconnect/mconnect@andyholmes.github.io ~/.local/share/gnome-shell/extensions/mconnect@andyholmes.github.io
    glib-compile-schemas gnome-shell-extension-mconnect/mconnect@andyholmes.github.io/schemas

Then enable the extension.
    

## Configuration

The extension itself currently has no configuration options.

## Usage

Enable the extension and enjoy the presence or absense of an indicator icon.
