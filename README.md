# MConnect integration for Gnome Shell 3.24.1+
This extension (will, as it and mconnect mature) provide integration for
mconnect into Gnome Shell, in the most native way possible.

[mconnect](https://github.com/bboozzoo/mconnect) is a KDE Connect protocol implementation in Vala/C.

## Installation

### mconnect

As of June 5, 2017, this extension currently relies on the
[dbus-support](https://github.com/bboozzoo/mconnect/tree/bboozzoo/dbus-support)
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
    glib-compile-schemas gnome-shell-extension-mconnect/mconnect@andyholmes.github.io/

To update you may:

    cd gnome-shell-extension-connect
    git pull
    glib-compile-schemas mconnect@andyholmes.github.io/
    

## Preferences

The following options are available in the extension preferences:

* **start-daemon** - Start the daemon automatically

    If true the daemon will be automatically started and restarted if it stops.
    If false the extension will wait for the daemon to be started.
    
* **debug** - Print debug messages to the log
    
    If true the extension will print verbosely to the log. See 'journalctl
    /usr/bin/gnome-shell -f -o cat' for output.
    

## Usage

Enable the extension and enjoy the presence or absense of an indicator icon.
