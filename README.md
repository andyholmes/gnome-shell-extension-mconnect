# NOTICE

I have all but abandoned working on this extension, in favour of my newer
extension [GSConnect][gsconnect] which is a complete implementation of the
KDE Connect protocol that doesn't rely on the KDE Connect server or MConnect
server. This is for the following reasons:

* This was originally intended to be a MConnect-only extension, however the
developer is busy with other projects and it remains largely incomplete.
* Interacting with the KDE Connect server over DBus is very restrictive and
makes many features hacky and other impossible to implement or fix.
* Trying to support two different backends (properly) requires almost as much
work as writing one.
* I grew tired of having ~500MB of KDE dependencies installed for a tiny program

I use GSConnect full-time without problems, however it only officially supports
Gnome Shell 3.24+ and has not been reviewed on the extension website yet. Thanks
for your understanding and support in developing this extension, and hopefully
the next.

## Overview

This extension integrates KDE Connect and/or MConnect into Gnome Shell.

[KDE Connect][kde-connect] uses an [Android app][android-app] and a desktop
server to securely exchange data, allowing file sharing, notification
forwarding, sending of text messages and many other features.

[MConnect][mconnect] is a work-in-progress implementation of that protocol in
Vala/C, with no KDE dependencies.

For those not using Gnome Shell, consider [indicator-kdeconnect][kindicator]
which is very stable, actively developed, supports all the same features, more
file managers and should work on any desktop with Gtk.


### Installation

The extension is now available on the [official extension website][ego]! The
***latest stable release*** can always be found in the [releases page][releases].

For instructions on how to build from Git, details about KDE Connect vs
MConnect and dependencies for optional features, please see the
[Installation Page](../../wiki/Installation) in the [Wiki](../../wiki).


### Features

* Send SMS messages
  * [Two-Way Conversations](../../wiki/SMS#two-way-conversations) (***Simulated***)
  * [Contacts Auto-complete](../../wiki/SMS#contacts-auto-complete) (***Optional***)
  
* Find devices by causing them to ring until found

* Mount and browse folders on your devices
  * [Auto-Mount](../../wiki/Preferences#device-auto-mount) (***Preference***)

* Send files to devices
  * [Nautilus Integration](../../wiki/Nautilus-Integration) (***Optional***)

* Monitor battery level and charging state

* Supports multiple backends
  * [KDE Connect](../../wiki/Installation#kde-connect)
  * [MConnect](../../wiki/Installation#mconnect)
  
* [Keyboard Shortcuts](../../wiki/Preferences#keyboard-shortcuts)

    
## Credits and Acknowledgements

[@albertvaka][albertvaka] and friends for creating KDE Connect, and
[@bboozzoo][bboozzoo] for developing MConnect based on their protocol.

[@Bajoja][Bajoja] and the [indicator-kdeconnect][kindicator] developers, for
advice and code I frequently reference.

[@hugosenari][hugosenari] for his Python shim for libgee, making support for
Folks possible and who graciously donated his time helping to make it work.

[@RaphaelRochet][RaphaelRochet] for [application-overview-tooltip][tooltips]
that was adapted to provide tooltips.

The [Numix][numix] project and Google's [Material Design][material] project,
some of whose icons are included in this extension.

And to anyone who has submitted a Pull Request or translation, opened an issue,
helped to debug, offered their opinion or expertise - thank you for visiting my
little stand at the [bazaar][bazaar].

### Special Mention

[Joey Sneddon][d0od88], who was the first to star this project, wrote a great
[article on OMG! Ubuntu][omg-article] and helped raise awareness of MConnect.

[@ptomato][ptomato] for the work and the [bright future][gjs-future] he has
contributed to GJS, as well as help on StackOverflow.

[@pwithnall][pwithnall] and [@nielsdg][nielsdg] for helping me out and
tolerating my harassment on the Gnome Bugzilla.

The screenshot of the extension features the [Vimix Dark Laptop][vimix] Gtk &
Gnome Shell theme with the [Numix Circle][numix] icon theme.

[screenshot]: https://raw.githubusercontent.com/andyholmes/gnome-shell-extension-mconnect/master/extra/screenshot.png
[gsconnect]: https://github.com/andyholmes/gnome-shell-extension-gsconnect
[kde-connect]: https://community.kde.org/KDEConnect
[android-app]: https://play.google.com/store/apps/details?id=org.kde.kdeconnect_tp
[mconnect]: https://github.com/bboozzoo/mconnect
[kindicator]: https://github.com/Bajoja/indicator-kdeconnect
[ego]: https://extensions.gnome.org/extension/1272/mconnect/
[releases]: https://github.com/andyholmes/gnome-shell-extension-mconnect/releases
[albertvaka]: https://github.com/albertvaka
[bboozzoo]: https://github.com/bboozzoo
[hugosenari]: https://github.com/hugosenari
[RaphaelRochet]: https://github.com/RaphaelRochet
[tooltips]: https://github.com/RaphaelRochet/applications-overview-tooltip
[Bajoja]: https://github.com/Bajoja
[bazaar]: https://wikipedia.org/wiki/The_Cathedral_and_the_Bazaar
[d0od88]: https://github.com/d0od88
[omg-article]: http://www.omgubuntu.co.uk/2017/08/kde-connect-gnome-extension
[ptomato]: https://github.com/ptomato
[pwithnall]: https://github.com/pwithnall
[nielsdg]: https://github.com/nielsdg
[gjs-future]: https://ptomato.wordpress.com/2017/07/30/modern-javascript-in-gnome-guadec-2017-talk/
[vimix]: https://github.com/vinceliuice/vimix-gtk-themes
[numix]: https://numixproject.org/
[material]: https://material.io/

