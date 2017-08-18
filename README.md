# KDE Connect/MConnect integration for Gnome Shell

![SMS window, Nautilus integration, Device Indicator & Menu][screenshot]


**Contents:**

* [Overview](#overview)
* [Features](#features)
* [Installation](#installation)
* [Dependencies](#dependencies)
  * [Contacts Auto-Complete](#contacts-auto-complete)
  * [Nautilus Integration](#nautilus-integration)
  * [MConnect](#mconnect)
  * [KDE Connect](#kde-connect)
* [Preferences](#preferences)
* [Contributing](#contributing)
  * [Translations](#translations)
* [Credits and Acknowledgements](#credits-and-acknowledgements)


## Overview

This extension provides integration for KDE Connect and or MConnect in Gnome
Shell, making use of as many *stock* resources as possible.

[KDE Connect](https://community.kde.org/KDEConnect) uses an
[Android app](https://play.google.com/store/apps/details?id=org.kde.kdeconnect_tp)
and a desktop server to securely exchange data, allowing file sharing,
notification sharing, sending of text messages and many other features.

[MConnect](https://github.com/bboozzoo/mconnect) is a KDE Connect protocol
implementation in Vala/C, with no KDE dependencies.

For those not using Gnome Shell, consider [indicator-kdeconnect][kindicator]
which is very stable, actively developed, supports all the same features, more
file managers and should work on any desktop with Gtk.


## Features

* Send SMS messages (optional: [Contacts Auto-complete](#contacts-auto-complete))
  
* Find devices by causing them to ring until found

* Mount and browse folders on your devices

* Send files to devices (optional: [Nautilus Integration](#nautilus-integration))

* Monitor battery level and charging state

* Supports [KDE Connect](#kde-connect) and [MConnect](#mconnect) as service providers


## Installation

The extension will appear on the official website once it has been reviewed.
Stable builds available in the [Releases page][releases] are recommended,
however, you may build and install from git with [Meson](http://mesonbuild.com):

    git clone https://github.com/andyholmes/gnome-shell-extension-mconnect.git
    meson gnome-shell-extension-mconnect/ build
    cd build
    ninja install-zip
    
    
## Dependencies

The extension is tested with Gnome Shell 3.24.x and has been reported working
on 3.18.x. Other recent versions may also work; please report your results.

### Contacts Auto-complete

Contacts auto-completion is an *optional* feature and requires support for
either [Folks][folks] or [Gnome Online Accounts][goa] and [GData][gdata],
although Folks is now preferred. For current Google Contacts users, your
contacts should continue to be supported; Folks aggregates GOA sources, and if
not supported the SMS Application will fallback to GOA and GData.

* At least one account in a provider supported by Folks
* Folks GIR (eg. gir1.2-folks-0.6)

OR

* Gnome Online Accounts with at least one Google account
* Gnome Online Accounts GIR (eg. gir1.2-goa-1.0)
* GData GIR (eg. gir1.2-gdata-0.0)

Please report any problems you encounter in [Issue #16](../../issues/16).


### Nautilus Integration

Nautilus integration is an *optional* feature and requires:

* Nautilus Python Bindings (eg. python-nautilus)
* Nautilus GIR (eg. gir1.2-nautilus-3.0)

See the [Contributing section](#contributing) for guidelines about contributing
support for other file managers.


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
* Some textual elements are retrieved from the service programmatically that
  may not be translatable

KDE Connect should be installed through normal, stable distribution channels.
    

## Preferences

The following options are available in the extension preferences and are
explained here in greater detail to users requiring more information:

* **Device Indicators** - Controls available via Indicators or the User Menu

    If enabled, each device will be given an indicator with an icon that
    represents the device type (smartphone, tablet or laptop) with an
    indication of its current state (this may be a colour or an emblem,
    depending on the icon theme). Controls for the device will be in popup menu
    available by clicking on the icon.
    
    If disabled, the same menu found in the indicator popup will instead appear
    in the *Mobile Devices* submenu found in the Gnome Shell User Menu. This is
    the menu on the far right of the panel where Session Controls, Wi-Fi,
    Location and other services are found.

* **Device Auto-Mount** - Automatically mount devices that support it

    When enabled, any device with the "Remote filesystem browser" (aka SFTP)
    plugin enabled will be automatically mounted, either when it becomes paired
    and connected or when the plugin is enabled.
    
    This has a few results. Any delay when pressing the *Remote Folder* icon in
    the device menu should be removed, and additionally, the device *may*
    maintain a more resilient connection. Be warned, this may result in a
    wake-lock on your device and negatively affect battery life.
    
* **Device Visibility** - Display devices in offline and unpaired states

    While paired and online devices will always be displayed, you may choose
    whether or not to display devices that are Offline or Unpaired. This does
    not affect any connection they have to the backend service.
    
* **Nautilus Integration** - Send files from the file browser context menu
    
    If enabled, a submenu will be added to the Nautilus context menu, listing
    the names of devices that are online, paired and have the "Share and
    receive" plugin enabled. Clicking on a device will send the currently
    selected files to that device.

    When enabled a symbolic link will be made from `nautilus-send-mconnect.py`
    in the extension directory to `~/.local/share/nautilus-python/extensions/`,
    after which a notification will appear advising you to restart Nautilus
    with button titled *Restart* (alternatively you may  run `nautilus -q` in a
    terminal). Be warned, restarting Nautilus will close any currently open
    windows. The same notification will appear when disabled and the symbolic
    link will be removed.

* **Service Auto-Start** - Start the service automatically and restart if stopped

    When the extension is enabled, the service will be automatically started if
    it isn't already running and restarted if it stops. For sanity reasons,
    only one attempt is made in each case. If this feature is disabled or the
    service fails to start, the extension will place an item in the User Menu
    titled *Enable* and wait for the service to be started.

* **Service Provider** - The service providing devices

    This option determines whether to use [KDE Connect](#kde-connect) or
    [MConnect](#mconnect) to provide access to devices. Please see the
    descriptions above for installation and current support status.

* **Service Settings** - Open the settings for the current service

    This is just a convenience button which will open the settings for the
    currently selected service provider. For KDE Connect it will open the
    *System Settings Module*, while for MConnect it will use `xdg-open` to open
    `~/.config/mconnect/mconnect.conf` in your default text editor.
    
* **Debug Mode** - Enable debug features and logging
    
    If true, the extension will enable some debug features and print verbosely
    to the log (see `journalctl /usr/bin/gnome-shell -f -o cat` for output).
    These messages may not include everything being emitted and the enabled
    features provide no extra functionality to regular users.
    
    Follow these steps to start debugging `sms.js` or `share.js`:
    
        cd ~/.local/share/gnome-shell/extensions/mconnect@andyholmes.github.io
        # lists devices in the format "<device-name>: <device-id>"
        gjs share.js -l
        gjs sms.js --device=<device-id>
        
    You may run either program with the --help flag to see all options.


## Contributing

Thank you for considering contributing to this project. It means that you not
only find it useful, but that you think there's something that could be done to
make it more useful, or useful to more people. *Any* suggestions are welcome,
including open discussion about the direction of the project as a whole. Don't
worry if you can't code, can't document, can't design graphics, can't translate
or have trouble with english; I still want to hear from you.

That being said, the current vision is to be a stock Gnome project, although
not necessarily *pure* Gnome. For example, there are no plans to include
integration for file managers other that Nautilus, however contributions for
other file managers would be accepted so long as including them doesn't *force*
other users to install dependencies that they don't need or wouldn't normally
be found in a stock Gnome desktop.

Additionally, all code should be written in [GJS][gjs] if at all possible and
should not be written in compiled languages that are architecture dependent. As
long as it can be unpacked from a ZIP and ready to go for everyone, that's good
enough.

The best way to get in touch is either by [opening a new issue][issue] or by
contacting one of the current [contributors][contributors] directly.
    
### Translations

The POT file for translations can be found in the po directory, or downloaded
directly from [here][pot]. If the POT file has not been regenerated recently,
you may do so in the [build directory](#installation) by running the command:

    ninja gnome-shell-extension-mconnect-pot
    
For contributors submitting a [Pull Request](../../pulls), try to remember to
run the these two commands to re-align the POT file and the PO files for each
language with current source (in the [build directory](#installation)):

    ninja gnome-shell-extension-mconnect-pot
    ninja gnome-shell-extension-mconnect-update-po
    
Please post any new translations you wish to have included in
[Issue #22](../../issues/22).

    
## Credits and Acknowledgements

[@albertvaka][albertvaka] and friends for creating KDE Connect, and
[@bboozzoo][bboozzoo] for developing MConnect based on their protocol.

[@Bajoja][Bajoja] and the [indicator-kdeconnect][kindicator] developers, for
advice and code I frequently reference.

Folks support is based on the Python shim for libgee written by
[@hugosenari][hugosenari], who graciously donated his time helping out.

This extension includes icons from the [Numix][numix] project and Google's
[Material Design][material] project.

A special mention goes to [@ptomato][ptomato] for the large amount of work and
the [bright future][gjs-future] he has contributed to GJS, as well as help on
StackOverflow.

The screenshot of the extension features the [Vimix Dark Laptop][vimix] Gtk &
Gnome Shell theme with the [Numix Circle][numix] icon theme.

[screenshot]: https://raw.githubusercontent.com/andyholmes/gnome-shell-extension-mconnect/master/extra/screenshot.png
[kindicator]: https://github.com/Bajoja/indicator-kdeconnect
[releases]: https://github.com/andyholmes/gnome-shell-extension-mconnect/releases
[folks]: https://wiki.gnome.org/Projects/Folks
[goa]: https://help.gnome.org/users/gnome-help/stable/accounts.html
[gdata]: https://developers.google.com/gdata/
[dbus-support]: https://github.com/bboozzoo/mconnect/tree/bboozzoo/dbus-support
[issue]: ../../issues/new
[contributors]: ../../graphs/contributors
[gjs]: https://wiki.gnome.org/Projects/Gjs
[pot]: https://github.com/andyholmes/gnome-shell-extension-mconnect/tree/master/po/gnome-shell-extension-mconnect.pot
[albertvaka]: https://github.com/albertvaka
[bboozzoo]: https://github.com/bboozzoo
[hugosenari]: https://github.com/hugosenari
[Bajoja]: https://github.com/Bajoja
[ptomato]: https://github.com/ptomato
[gjs-future]: https://ptomato.wordpress.com/2017/07/30/modern-javascript-in-gnome-guadec-2017-talk/
[vimix]: https://github.com/vinceliuice/vimix-gtk-themes
[numix]: https://numixproject.org/
[material]: https://material.io/

