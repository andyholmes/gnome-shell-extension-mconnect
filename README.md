# KDE Connect/MConnect integration for Gnome Shell

![SMS window, Nautilus integration, Device Indicator & Menu][screenshot]

This extension provides integration for KDE Connect/MConnect in Gnome Shell,
in the most native way possible.

[KDE Connect](https://community.kde.org/KDEConnect) uses an
[Android app](https://play.google.com/store/apps/details?id=org.kde.kdeconnect_tp)
and a desktop server to securely exchange data, allowing file sharing,
notification sharing, sending of text messages and many other features.

[MConnect](https://github.com/bboozzoo/mconnect) is a KDE Connect protocol
implementation in Vala/C.

## Features

* Send SMS messages with optional Google Contacts auto-completion
  
* Find devices by causing them to ring until found

* Mount and browse folders on your devices

* Send files to devices with optional Nautilus integration

* Monitor battery level and charging state

* Supports KDE Connect and MConnect (WIP) as service providers


## Installation

The extension will appear on the official website once it has been reviewed.
Stable builds are available for download in the [Releases page][releases], or
you may build and install from git with [Meson](http://mesonbuild.com):

    git clone https://github.com/andyholmes/gnome-shell-extension-mconnect.git
    meson gnome-shell-extension-mconnect/ build
    cd build
    ninja install-zip
    
    
### Dependencies

The extension is known to work with Gnome Shell 3.24.x, but other recent
versions may also work. Additionally, either KDE Connect or MConnect must be
installed. Optional features and their requirements include:

**Google Contacts Auto-complete in SMS Application**
* Gnome Online Accounts with at least one Google account
* Gnome Online Accounts GIR (eg. gir1.2-goa-1.0)
* GData GIR (eg. gir1.2-gdata-0.0)

**Nautilus Integration**
* Nautilus Python Bindings (eg. python-nautilus)
* Nautilus GIR (eg. gir1.2-nautilus-3.0)


### MConnect

As of August 2017, MConnect is in an early stage of development. If you have
experience with Vala, consider contributing to the project. Currently MConnect
supports:

* Pairing and unpairing with devices
* Sending and receiving notifications (automatically handled by MConnect)
* Monitoring battery level and charging state

MConnect support relies on the [dbus-support branch][dbus-support] and must be
built from git. See the [repository][dbus-support] for dependencies.

    git clone -b bboozzoo/dbus-support https://github.com/bboozzoo/mconnect.git
    cd mconnect
    autoreconf -if 
    ./configure --prefix=/usr
    make
    
If MConnect is in your `PATH`, it can either be started from the User Menu or
the extension can be configured to start it automatically. Once you have run
`make` you may install it cleanly as a package if `checkinstall` is available:

    sudo checkinstall --type=<slackware|rpm|debian>
    
Otherwise you may run MConnect from the build directory:

    ./mconnect -d
    

### KDE Connect

KDE Connect support is far more complete but still has a few issues and missing
features:

* Mounting a Device can cause Gnome Shell to hang for a short period (~30s)
* Encryption information is not available in the extension
* Pinging devices is not possible in the extension
* If device goes offline, there is no way to initiate discovery or reconnection
* Some textual elements are retrieved from the service programmatically that
  may not be translatable

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
    stops. Otherwise the extension will wait for the service to be started.

* **Service Provider**

    Whether to use KDE Connect or MConnect to provide access to devices.
    
* **Debug Mode**
    
    If true, the extension will print verbosely to the log. See 'journalctl
    /usr/bin/gnome-shell -f -o cat' for output.
    
    
## Credits and Acknowledgements

[@albertvaka][albertvaka] and friends for creating KDE Connect, and
[@bboozzoo][bboozzoo] for developing MConnect based on their protocol.

[@Bajoja][Bajoja] and the indicator-kdeconnect developers, for advice and code
I frequently reference.

A special mention goes to [@ptomato][ptomato] for the large amount of work and
the [bright future][bright-future] he has contributed to GJS, as well as help
on StackOverflow.

The screenshot of the extension features the [Vimix Dark Laptop][vimix] Gtk &
Gnome Shell theme with the [Numix Circle][numix] icon theme.

[screenshot]: https://raw.githubusercontent.com/andyholmes/gnome-shell-extension-mconnect/master/extra/screenshot.png
[releases]: https://github.com/andyholmes/gnome-shell-extension-mconnect/releases
[dbus-support]: https://github.com/bboozzoo/mconnect/tree/bboozzoo/dbus-support
[albertvaka]: https://github.com/albertvaka
[bboozzoo]: https://github.com/bboozzoo
[Bajoja]: https://github.com/Bajoja
[ptomato]: https://github.com/ptomato
[bright-future]: https://ptomato.wordpress.com/2017/07/30/modern-javascript-in-gnome-guadec-2017-talk/
[vimix]: https://github.com/vinceliuice/vimix-gtk-themes
[numix]: https://numixproject.org/

