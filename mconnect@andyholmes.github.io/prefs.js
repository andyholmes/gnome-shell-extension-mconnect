// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;

// Local Imports
const Me = imports.misc.extensionUtils.getCurrentExtension();
const { debug, Schema, Settings } = Me.imports.utils;


function init() {
    debug('initializing preferences');
    
    // TODO: localization?
};

// Extension Preferences
function buildPrefsWidget() {
    let builder = new Gtk.Builder();
    builder.add_from_file(Me.path + '/prefs.ui');
    
    // Each GSetting key is given an associated widget named 'gsetting-key'
    // and a label named 'gsetting-key-label'. The preferences widget is
    // then programatically built and each option connect to GSettings.
    let optionsList = [
        'per-device-indicators',
        'show-offline',
        'show-untrusted',
        'start-daemon',
        'use-kdeconnect',
        'debug'
    ];
    
    let label;
    
    optionsList.forEach((option) => {
        label = builder.get_object(option + '-label');
        label.set_label(Schema.get_key(option).get_summary());
        Settings.bind(
            option,
            builder.get_object(option),
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
    });

    // About
    // FIXME: Gtk.show_about_dialog()
//    Gtk.show_about_dialog (
//        window,
//        "artists", artists,
//        "authors", authors,
//        "translator-credits", "translator-credits",
//        "program-name", Me.metadata.name.toString(),
//        "title", "About " + Me.metadata.name.toString(),
//        "comments", Me.metadata.description.toString(),
//        "copyright", "Copyright 2017 Andy Holmes",
//        "license-type", Gtk.License.GPL_2_0,
//        "logo-icon-name", "x-office-address-book",
//        "version", Me.metadata.version.toString(),
//        "website", Me.metadata.url.toString(),
//        "wrap-license", true);
//    }
//    
    builder.get_object('extension-name').set_label(Me.metadata.name.toString());
    builder.get_object('extension-description').set_label(Me.metadata.description.toString());
    builder.get_object('extension-url').set_uri(Me.metadata.url.toString());
    //builder.get_object('extension-version').set_label(Me.metadata.version.toString());
    
    //
    let widget = builder.get_object('prefs-widget');
    widget.show_all();
    
    return widget;
};
