#!/usr/bin/env gjs

"use strict";

const Lang = imports.lang;

const GdkPixbuf = imports.gi.GdkPixbuf;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;

// Local Imports
function getPath() {
    // Diced from: https://github.com/optimisme/gjs-examples/
    let m = new RegExp('@(.+):\\d+').exec((new Error()).stack.split('\n')[1]);
    return Gio.File.new_for_path(m[1]).get_parent().get_path();
}

imports.searchPath.push(getPath());
const { assert, debug, Settings } = imports.utils;
const MConnect = imports.mconnect;
const KDEConnect = imports.kdeconnect;


// User Interface
const SMSWindow = Lang.Class({
    Name: "SMSWindow",
    Extends: Gtk.Window,
    
    _init: function (dbusPath) {
        
        this.parent({
            default_height: 300,
            default_width: 300,
            title: "Send SMS",
            startup_id: dbusPath
        });
        
        this.dbusPath = dbusPath;
        
        if (this.dbusPath.split("/")[2] == "mconnect") {
            debug("selecting MConnect as backend");
            this.device = new imports.mconnect.Device(this.dbusPath);
        } else {
            debug("selecting KDE Connect as backend");
            this.device = new imports.kdeconnect.Device(this.dbusPath);
        }
        
        // HeaderBar
        let headerBar = new Gtk.HeaderBar({
            title: "SMS Conversation",
            subtitle: "To ... via " + this.device.name,
            show_close_button: true
        });
        this.set_titlebar(headerBar);
        
        // Main Widget
        let box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            margin: 12,
            spacing: 12
        });
        this.add(box);
        
        // Main Widget -> Contacts Search
        this.contactEntry = new Gtk.Entry({
            hexpand: true,
            placeholder_text: "Phone number...",
            input_purpose: Gtk.InputPurpose.PHONE, // TODO: contact search
            secondary_icon_name: "",
            secondary_icon_activatable: false,
            secondary_icon_tooltip_text: "Invalid phone number!"
        });
        this.contactEntry.get_icon_at_pos(0, 0).visible = false;
        //this.contactEntry.connect("changed", Lang.bind(this, this._search));
        
        this.contactEntry.connect(
            "activate",
            (entry) => { } // TODO: only one of contact or msg active at once
        );
        
        box.add(this.contactEntry);
        
        // Main Widget -> Conversation View
        let scrolledWindow = new Gtk.ScrolledWindow({
            hexpand: true,
            vexpand: true
        });
        box.add(scrolledWindow);
        
        this.conversationView = new Gtk.TextView({
            hexpand: true,
            vexpand: true,
            cursor_visible: false,
            editable: false,
            wrap_mode: Gtk.WrapMode.WORD
        });
        scrolledWindow.add(this.conversationView)
        
        this.conversationBuffer = new Gtk.TextBuffer();
        this.conversationView.set_buffer(this.conversationBuffer)
        
        // Main Widget -> Message Entry
        this.messageEntry = new Gtk.Entry({
            hexpand: true,
            placeholder_text: "Type message here...",
            secondary_icon_name: "mail-reply-sender-symbolic",
            secondary_icon_tooltip_text: "Send..."
        });
        box.add(this.messageEntry);
        
        this.messageEntry.connect(
            'activate',
            (entry, signal_id, cb_data) => {
                this.send(entry, signal_id, cb_data);
            }
        );
        this.messageEntry.connect(
            'icon-release',
            (entry, signal_id, cb_data) => {
                this.send(entry, signal_id, cb_data);
            }
        );

        this.connect("destroy", Gtk.main_quit);
        this.show_all();
    },
    
    // Private Methods
    _checkMessage: function () {
        // TODO: figure what KDE Connect does internally
        debug("sms.SMSWindow._checkMessage()");
        return (this.messageEntry.text != "");
    },
    
    _checkNumber: function () {
        // TODO: figure what KDE Connect does internally
        debug("sms.SMSWindow._checkNumber()");
        return (this.contactEntry.text != "");
    },
    
    // Public Methods
    send: function (entry, signal_id, event) {
        // TODO: more sanity checks
        if (this._checkNumber()) {
            this.contactEntry.secondary_icon_name = "";
        } else {
            this.contactEntry.secondary_icon_name = "dialog-error-symbolic";
            return;
        }
        
        if (this._checkMessage()) {
            debug("sending: " + entry.text + " to " + this.contactEntry.text);
            this.device.plugins.telephony.send(this.contactEntry.text, entry.text)
            this.conversationBuffer.text += "Me: " + entry.text + "\n";
            entry.text = "";
        }
    }
});

Gtk.init(null);
let foo = new SMSWindow(ARGV[0]);
Gtk.main();
