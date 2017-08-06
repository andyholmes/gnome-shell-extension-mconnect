# KDE Connect/MConnect integration for Gnome Shell

![SMS window, Nautilus integration, Device Indicator & Menu][screenshot]

This extension aims to provide integration for KDE Connect/MConnect in Gnome
Shell, in the most native way possible.

[KDE Connect](https://community.kde.org/KDEConnect) uses an
[Android app](https://play.google.com/store/apps/details?id=org.kde.kdeconnect_tp)
and a desktop server to securely exchange data, allowing file sharing,
notification sharing, sending of text messages and many other features.

[MConnect](https://github.com/bboozzoo/mconnect) is a KDE Connect protocol
implementation in Vala/C.

## Features

* Send SMS messages with optional Google Contacts auto-completion via Gnome
  Online Accounts
  
* Find your devices by causing them to ring until found

* Mount and browse folders on your devices

* Send files to your devices with optional Nautilus integration

* Monitor battery charging state and level

* Supports KDE Connect and MConnect as service providers


## Installation

The extension will appear on the extension website once it has been accepted.
Early release builds are available in the [Releases page][releases], or you may
build and install from git with [Meson](http://mesonbuild.com):

    git clone https://github.com/andyholmes/gnome-shell-extension-mconnect.git
    meson gnome-shell-extension-mconnect/ build
    cd build
    ninja install-zip


### MConnect

As of August 2017, MConnect support is limited and currently relies on the
[dbus-support branch][dbus-support] of MConnect. In the future this will be the
preferred backend as it doesn't depend on KDE libraries. If you have experience
with Vala, consider contributing to the project. Currently you may:

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

Functionality with KDE Connect is far more complete but still lacks a few
features:

* pinging devices
* file manager integration only supports Nautilus
* encryption information is not viewable in the extension

KDE Connect should be installed through normal, stable distribution channels.
    

## Preferences

The following options are available in the extension preferences:

* **Device Visibility**

    In what states a device will be made visible to the user. Paired, online
    devices will always be shown.
    
* **Nautilus Integration**

    If true, a submenu will be added to the Nautilus context menu to allow
    sending files to devices directly from the file browser.

* **Service Autostart**

    If true, the service will be automatically started and restarted if it
    stops. If false, the extension will wait for the service to be started.

* **Service Provider**

    Whether to use KDE Connect or MConnect to provide access to devices.
    
* **Debug Mode**
    
    If true, the extension will print verbosely to the log. See 'journalctl
    /usr/bin/gnome-shell -f -o cat' for output.

[screenshot]: https://raw.githubusercontent.com/andyholmes/gnome-shell-extension-mconnect/master/extra/screenshot.png)
[releases]: https://github.com/andyholmes/gnome-shell-extension-mconnect/releases
[dbus-support]: https://github.com/bboozzoo/mconnect/tree/bboozzoo/dbus-support

