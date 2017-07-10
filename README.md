# MConnect integration for Gnome Shell 3.24+
This extension provides integration for MConnect into Gnome Shell, in the most
native way possible.

[MConnect](https://github.com/bboozzoo/mconnect) is a KDE Connect protocol
implementation in Vala/C.

[KDE Connect](https://community.kde.org/KDEConnect) uses an
[Android app](https://play.google.com/store/apps/details?id=org.kde.kdeconnect_tp)
and a desktop server to securely exchange data, allowing plugins to offer
file sharing, notification sharing, sending of text messages and many other
features.

**NOTE:** MConnect and this extension are in an early stage of development.

## Installation

### MConnect

As of June 2017, this extension currently relies on the
[dbus-support](https://github.com/bboozzoo/mconnect/tree/bboozzoo/dbus-support)
branch of MConnect. First build mconnect (see repository for dependencies):

    git clone -b bboozzoo/dbus-support https://github.com/bboozzoo/mconnect.git
    cd mconnect
    autoreconf -if 
    ./configure --prefix=/usr
    make
    
Then simply run:

    ./mconnect -d
    
If MConnect is in your `PATH`, it can be started from the User Menu or the
extension can be configured to start it automatically. Once you have run `make`
you may install it as a package if `checkinstall` is available:

    sudo checkinstall --type=<slackware|rpm|debian>

    
### Extension

The extension will appear on the extension website when reasonably useful. You
may build and install the extension now with [Meson](http://mesonbuild.com):

    git clone https://github.com/andyholmes/gnome-shell-extension-mconnect.git
    mkdir builddir
    cd builddir
    meson ../gnome-shell-extension-mconnect .
    ninja install-zip
    

## Preferences

The following options are available in the extension preferences:

* **per-device-indicators** - Show per-device indicators

    If true, show an indicator in the Status Area for each device. If false,
    devices will be available in the User Menu.

* **show-offline** - Show offline devices

    If true, cached devices will be shown in the interface even when they are
    offline.

* **show-unallowed** - Show unallowed devices

    If true, devices will be shown in the interface even if they have not been
    marked allowed or formally paired.

* **start-daemon** - Start the daemon automatically
    If true the daemon will be automatically started and restarted if it stops.
    If false the extension will wait for the daemon to be started.
    
* **debug** - Print debug messages to the log
    
    If true the extension will print verbosely to the log. See 'journalctl
    /usr/bin/gnome-shell -f -o cat' for output.
    

## Usage

Functionality is still limited. Currently you may:

* mark devices as allowed (but not unallowed)
* receive and forward notifications (automatically handled by MConnect)
* monitor battery level and charging state

Controls for each device are in a menu, available either as a submenu in the
User Menu or via a status indicator, depending on your settings.

