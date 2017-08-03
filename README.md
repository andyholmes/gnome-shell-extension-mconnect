# KDE Connect/MConnect integration for Gnome Shell

This extension aims to provide integration for KDE Connect/MConnect in Gnome
Shell, in the most native way possible.

![Panel Menu](https://raw.githubusercontent.com/andyholmes/gnome-shell-extension-mconnect/master/extra/device-screenshot.png)
![SMS Window with auto-complete](https://raw.githubusercontent.com/andyholmes/gnome-shell-extension-mconnect/master/extra/sms-screenshot.png)

[KDE Connect](https://community.kde.org/KDEConnect) uses an
[Android app](https://play.google.com/store/apps/details?id=org.kde.kdeconnect_tp)
and a desktop server to securely exchange data, allowing file sharing,
notification sharing, sending of text messages and many other features.

[MConnect](https://github.com/bboozzoo/mconnect) is a KDE Connect protocol
implementation in Vala/C.


## Installation

The extension will appear on the extension website when reasonably useful and
stable. Pre-release builds are available in the [Releases page](https://github.com/andyholmes/gnome-shell-extension-mconnect/releases),
or you may build and install from git with [Meson](http://mesonbuild.com):

    git clone https://github.com/andyholmes/gnome-shell-extension-mconnect.git
    meson gnome-shell-extension-mconnect/ build
    cd build
    ninja install-zip


### MConnect

As of July 2017, MConnect support is limited and currently relies on the
[dbus-support](https://github.com/bboozzoo/mconnect/tree/bboozzoo/dbus-support)
branch of MConnect. In the future this will be the preferred backend as it does
not depend on KDE libraries. If you have experience with Vala, consider
contributing to the project. Currently you may:

* initiate pairing with devices (but not unpairing)
* receive and forward notifications (automatically handled by MConnect)
* monitor battery level and charging state

First build mconnect (see repository for dependencies):

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
    

### KDE Connect

Functionality with KDE Connect is far more complete but still lacks features,
contains bugs and has usability issues. Missing functionality includes, but is
not limited to:

* file manager integration only supports Nautilus
* encryption information is not viewable in the extension

KDE Connect should be installed through normal, stable distribution channels.
    

## Preferences

The following options are available in the extension preferences:

* **device-visibility** - Device visibility

    In what states a device will be made visible to the user. Possible options
    are 'OFFLINE' and 'UNPAIRED'. Paired, online devices will always be shown.

* **service-autostart** - Start the service automatically

    If true, the service will be automatically started and restarted if it
    stops. If false the extension will wait for the service to be started.

* **service-backend** - Backend service

    The backend to use as the service. Possible options are 'MCONNECT' and
    'KDECONNECT'.
    
* **debug** - Print debug messages to the log
    
    If true the extension will print verbosely to the log. See 'journalctl
    /usr/bin/gnome-shell -f -o cat' for output.

