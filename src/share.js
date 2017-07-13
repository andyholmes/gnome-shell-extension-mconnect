#!/usr/bin/env gjs

"use strict";

const Lang = imports.lang;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;


Gtk.init(null)

let dialog = new Gtk.FileChooserDialog({
    title: "Send file...",
    action: Gtk.FileChooserAction.OPEN,
    modal: false
});

dialog.set_modal(false);
dialog.add_button("Cancel", Gtk.ResponseType.CANCEL);
dialog.add_button("Send", Gtk.ResponseType.OK);
dialog.connect("delete-event", Gtk.main_quit);

if (dialog.run() === Gtk.ResponseType.OK) {
    let stdout = new Gio.UnixOutputStream({ fd: 1 });
    stdout.write(dialog.get_filename() + "\n", null);
}

dialog.close();

Gtk.main();


