#!/usr/bin/env gjs

// share.js - A simple FileChooserDialog for sending files

const Lang = imports.lang;
const Gettext = imports.gettext.domain('gnome-shell-extension-mconnect');
const _ = Gettext.gettext;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;


/** TODO: device selector, if !ARGV[0] */


Gtk.init(null);

let application_name = _("MConnect");

GLib.set_prgname(application_name);
GLib.set_application_name(application_name);

let dialog = new Gtk.FileChooserDialog({
    title: _("Send file..."),
    action: Gtk.FileChooserAction.OPEN,
    icon_name: "send-to",
    modal: true
});

dialog.add_button(_("Cancel"), Gtk.ResponseType.CANCEL);
dialog.add_button(_("Send"), Gtk.ResponseType.OK);
dialog.set_default_response(Gtk.ResponseType.OK);
dialog.connect("delete-event", Gtk.main_quit);

if (dialog.run() === Gtk.ResponseType.OK) {
    let stdout = new Gio.UnixOutputStream({ fd: 1 });
    stdout.write(dialog.get_filename() + "\n", null);
}

dialog.destroy();


