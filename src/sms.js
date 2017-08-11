/**
 * sms.js - A simple dialog for sending SMS messages with MConnect/KDE Connect
 * with (optional) Google Contacts auto-completion via Gnome Online Accounts.
 *
 * A great deal of credit and appreciation is owed to the indicator-kdeconnect
 * developers for the sister Python script 'Sms.py':
 * 
 * https://github.com/Bajoja/indicator-kdeconnect/blob/master/src/sms/Sms.py
 */

const Lang = imports.lang;
const System = imports.system;
const Gettext = imports.gettext.domain("gnome-shell-extension-mconnect");
const _ = Gettext.gettext;
const GData = imports.gi.GData;
const GdkPixbuf = imports.gi.GdkPixbuf;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Goa = imports.gi.Goa;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;

// Local Imports
function getPath() {
    // Diced from: https://github.com/optimisme/gjs-examples/
    let m = new RegExp("@(.+):\\d+").exec((new Error()).stack.split("\n")[1]);
    return Gio.File.new_for_path(m[1]).get_parent().get_path();
}

imports.searchPath.push(getPath());

const KDEConnect = imports.kdeconnect;
const MConnect = imports.mconnect;
const { initTranslations, Settings } = imports.lib;

const ServiceProvider = {
    MCONNECT: 0,
    KDECONNECT: 1
};

initTranslations();

/** Phone Number Type Icons (https://material.io/icons/) */                
const SVG_TYPE_HOME = GdkPixbuf.Pixbuf.new_from_stream(
    Gio.MemoryInputStream.new_from_bytes(
        GLib.Bytes.new('\
            <svg fill="#888" height="18" viewBox="0 0 24 24" width="18" xmlns="http://www.w3.org/2000/svg"> \
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/> \
                <path d="M0 0h24v24H0z" fill="none"/> \
            </svg>'
        )
    ),
    null
);

const SVG_TYPE_MOBILE = GdkPixbuf.Pixbuf.new_from_stream(
    Gio.MemoryInputStream.new_from_bytes(
        GLib.Bytes.new('\
            <svg fill="#888" height="18" viewBox="0 0 24 24" width="18" xmlns="http://www.w3.org/2000/svg"> \
                <path d="M16 1H8C6.34 1 5 2.34 5 4v16c0 1.66 1.34 3 3 3h8c1.66 0 3-1.34 3-3V4c0-1.66-1.34-3-3-3zm-2 20h-4v-1h4v1zm3.25-3H6.75V4h10.5v14z"/> \
                <path d="M0 0h24v24H0z" fill="none"/> \
            </svg>'
        )
    ),
    null
);

const SVG_TYPE_WORK = GdkPixbuf.Pixbuf.new_from_stream(
    Gio.MemoryInputStream.new_from_bytes(
        GLib.Bytes.new('\
            <svg fill="#888" height="18" viewBox="0 0 24 24" width="18" xmlns="http://www.w3.org/2000/svg"> \
                <path d="M0 0h24v24H0z" fill="none"/> \
                <path d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z"/> \
            </svg>'
        )
    ),
    null
);

const SVG_TYPE_OTHER = GdkPixbuf.Pixbuf.new_from_stream(
    Gio.MemoryInputStream.new_from_bytes(
        GLib.Bytes.new('\
            <svg fill="#888" height="18" viewBox="0 0 24 24" width="18" xmlns="http://www.w3.org/2000/svg"> \
                <path d="M0 0h24v24H0z" fill="none"/> \
                <path d="M3 6h18V4H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4v-2H3V6zm10 6H9v1.78c-.61.55-1 1.33-1 2.22s.39 1.67 1 2.22V20h4v-1.78c.61-.55 1-1.34 1-2.22s-.39-1.67-1-2.22V12zm-2 5.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM22 8h-6c-.5 0-1 .5-1 1v10c0 .5.5 1 1 1h6c.5 0 1-.5 1-1V9c0-.5-.5-1-1-1zm-1 10h-4v-8h4v8z"/> \
            </svg>'
        )
    ),
    null
);

const SVG_TYPE_DEFAULT = GdkPixbuf.Pixbuf.new_from_stream(
    Gio.MemoryInputStream.new_from_bytes(
        GLib.Bytes.new('\
            <svg fill="#888" height="18" viewBox="0 0 24 24" width="18" xmlns="http://www.w3.org/2000/svg"> \
                <path d="M0 0h24v24H0z" fill="none"/> \
                <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/> \
            </svg>'
        )
    ),
    null
);

const SVG_ACTION_SEND = GdkPixbuf.Pixbuf.new_from_stream(
    Gio.MemoryInputStream.new_from_bytes(
        GLib.Bytes.new('\
            <svg fill="#888" height="16" viewBox="0 0 24 24" width="16" xmlns="http://www.w3.org/2000/svg"> \
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/> \
                <path d="M0 0h24v24H0z" fill="none"/> \
            </svg>'
        )
    ),
    null
);

/** Phone Number types that support receiving texts */
const SUPPORTED_TYPES = [
    GData.GD_PHONE_NUMBER_HOME,
    GData.GD_PHONE_NUMBER_WORK,
    GData.GD_PHONE_NUMBER_OTHER,
    GData.GD_PHONE_NUMBER_MOBILE,
    GData.GD_PHONE_NUMBER_MAIN,
    GData.GD_PHONE_NUMBER_PAGER
];

/** Return a list of Google accounts */
function getAccounts() {
    let goaClient = Goa.Client.new_sync(null, null);
    let goaAccounts = goaClient.get_accounts();
    
    for (let goaAccount in goaAccounts) {
        let acct = goaAccounts[goaAccount].get_account();
        
        if (acct.provider_type === "google") {
            yield new GData.ContactsService({
                authorizer: new GData.GoaAuthorizer({
                    goa_object: goaClient.lookup_by_id(acct.id)
                })
            })
        }
    }
}

/** Return a list of Google contacts for account */
function getContacts (account) {
    let query = new GData.Query({ q: "" });
    let count = 0;
    let contacts = [];
    
    while (true) {
        let feed = account.query_contacts(
            query, // query,
            null, // cancellable
            (contact) => {
                if (contact.get_phone_numbers().length > 0) {
                    contacts.push(contact);
                }
            },
            null
        );
        
        count += feed.items_per_page;
        query.start_index = count;
        
        if (count > feed.total_results) { break; }
    }
    
    return contacts;
}

/** A Gtk.EntryCompletion subclass for Google Contacts */
const ContactCompletion = new Lang.Class({
    Name: "ContactCompletion",
    Extends: Gtk.EntryCompletion,
    
    _init: function () {
        this.parent();
        
        // Track suggested completions
        this._matched = [];
        this._last = null;
        
        // Define a completion model
        let listStore = new Gtk.ListStore();
        listStore.set_column_types([
            GdkPixbuf.Pixbuf,       // Contact Avatar
            GObject.TYPE_STRING,    // Contact Name
            GObject.TYPE_STRING,    // Contact Phone URI
            GdkPixbuf.Pixbuf        // Contact Phone Type
        ]);
        listStore.set_sort_column_id(1, Gtk.SortType.ASCENDING);
        //listStore.set_sort_func(1, this._sort, null, null);
        this.set_model(listStore);
        
        // Avatar
        let avatarCell = new Gtk.CellRendererPixbuf();
        this.pack_start(avatarCell, false);
        this.add_attribute(avatarCell, "pixbuf", 0);
        // Title
        this.set_text_column(1);
        // Type Icon
        let typeCell = new Gtk.CellRendererPixbuf();
        this.pack_start(typeCell, false);
        this.add_attribute(typeCell, "pixbuf", 3);
        
        this.set_match_func(Lang.bind(this, this._match), null, null);
        this.connect("match-selected", Lang.bind(this, this._select));
        
        if (Goa !== undefined && GData !== undefined) {
            for (let account of getAccounts()) {
                this._populate(account);
            }
        }
    },
    
    _populate: function (account) {
        // Load a default avatar
        // TODO: BUG: https://bugzilla.gnome.org/show_bug.cgi?id=785207
        let photo = Gtk.IconTheme.get_default().load_icon(
                "avatar-default-symbolic", 0, 0
        );
        
        for (let contact of getContacts(account)) {
            // Each phone number gets its own completion entry
            for (let phoneNumber of contact.get_phone_numbers()) {
                // Exclude number types that are unable to receive texts
                if (SUPPORTED_TYPES.indexOf(phoneNumber.relation_type) < 0) {
                    continue;
                }
                
                // Use the URI form of the number, if possible
                let number;
                
                if (phoneNumber.uri !== null) {
                    number = phoneNumber.uri.slice(4);
                } else {
                    number = phoneNumber.number;
                }
                
                // Append the number to the title column
                let title = [contact.title, " <", number, ">"].join("");
                
                // Phone Type Icon
                let type;
                
                switch (phoneNumber.relation_type) {
                    case GData.GD_PHONE_NUMBER_HOME:
                        type = SVG_TYPE_HOME;
                        break;
                    case GData.GD_PHONE_NUMBER_MOBILE:
                        type = SVG_TYPE_MOBILE;
                        break;
                    case GData.GD_PHONE_NUMBER_WORK:
                        type = SVG_TYPE_WORK;
                        break;
                    case GData.GD_PHONE_NUMBER_OTHER:
                        type = SVG_TYPE_OTHER;
                        break;
                    default:
                        type = SVG_TYPE_DEFAULT;
                }
            
                this.model.set(
                    this.model.append(),
                    [0, 1, 2, 3, 4],
                    [photo, title, number, type]
                );
            }
        }
    },
    
    _match: function (completion, key, tree_iter) {
        let model = completion.get_model();
        let title = model.get_value(tree_iter, 1).toLowerCase();
        let number = model.get_value(tree_iter, 2);
        let oldContacts = key.split(",").slice(0, -1);
        
        // Set key to the last or only search item, trimmed of whitespace
        if (key.indexOf(",") > -1) { key = key.split(",").pop().trim(); }
        // Return if key is empty or this contact has already been added
        if (!key.length || oldContacts.indexOf(title) > -1) { return false; }
        // Clear current matches if the key has changed and reset last key
        if (key !== this._last) {
            this._matched = [];
            this._last = key;
        }
        
        if (this._matched.length >= 20) { return false; }
        
        // Match title (eg. "Name (type)") and number
        if (title.indexOf(key) > -1 || number.indexOf(key) > -1) {
            this._matched.push(model.get_string_from_iter(tree_iter));
            return true;
        }
    },
    
    _select: function (completion, model, tree_iter) {
        let entry = completion.get_entry();
        let oldContacts = entry.text.split(",").slice(0, -1);
        let newContact = model.get_value(tree_iter, 1);
        
        // Ignore duplicate selections
        if (oldContacts.indexOf(newContact) > -1) { return; }
        
        entry.set_text(
            oldContacts.join(", ")
            + ((oldContacts.length) ? ", " : "")
            + newContact + ", "
        );
        
        entry.set_position(-1);
        this._matched = [];
        
        return true;
    },
    
    // https://gist.github.com/andrei-m/982927#gistcomment-2059365
    _sort: function (model, a, b, user_data) {
	    var tmp;
	    if (a.length === 0) { return b.length; }
	    if (b.length === 0) { return a.length; }
	    if (a.length > b.length) { tmp = a; a = b; b = tmp; }

	    var i, j, res, alen = a.length, blen = b.length, row = Array(alen);
	    for (i = 0; i <= alen; i++) { row[i] = i; }

	    for (i = 1; i <= blen; i++) {
		    res = i;
		    for (j = 1; j <= alen; j++) {
			    tmp = row[j - 1];
			    row[j - 1] = res;
			    res = b[i - 1] === a[j - 1] ? tmp : Math.min(tmp + 1, Math.min(res + 1, row[j] + 1));
		    }
	    }
	    return res;
        
    }
});

/** A Gtk.Entry subclass for contact names and phone numbers */
const ContactEntry = new Lang.Class({
    Name: "ContactEntry",
    Extends: Gtk.SearchEntry,
    
    _init: function () {
        this.parent({
            hexpand: true,
            placeholder_text: _("Phone number..."),
            primary_icon_name: "call-start-symbolic",
            primary_icon_activatable: false,
            primary_icon_sensitive: true,
            input_purpose: Gtk.InputPurpose.PHONE,
            completion: new ContactCompletion()
        });
        
        // Set the entry properties if there are contacts
        if (this.completion.model.iter_n_children(null)) {
            this.placeholder_text = _("Search contacts...");
            this.primary_icon_name = "goa-account-google";
            this.input_purpose = Gtk.InputPurpose.FREE_FORM;
        }
    
        // Select the first completion suggestion on "activate"
        this.connect("activate", () => { this._select(this); });
        
        // Remove error class on "changed"
        this.connect("changed", (entry) => {
            entry.secondary_icon_name = "";
            let styleContext = entry.get_style_context();
            
            if (styleContext.has_class("error")) {
                styleContext.remove_class("error");
            }
        });
    },
    
    _select: function (entry) {
        let completion = entry.get_completion();
        
        if (completion._matched.length > 0) {
            let iter_path = completion._matched["0"];
            let [b, iter] = completion.model.get_iter_from_string(iter_path);
            let oldContacts = entry.text.split(",").slice(0, -1);
            let newContact = completion.model.get_value(iter, 1);
        
            // Ignore duplicate selections
            if (oldContacts.indexOf(newContact) > -1) { return; }
        
            entry.set_text(
                oldContacts.join(", ")
                + ((oldContacts.length) ? ", " : "")
                + newContact + ", "
            );
        
            entry.set_position(-1);
            completion._matched = [];
        }
    }
});

/** SMS Window */
const ApplicationWindow = new Lang.Class({
    Name: "ApplicationWindow",
    Extends: Gtk.ApplicationWindow,
    
    _init: function(application, device) {
        this.parent({
            application: application,
            title: "MConnect",
            default_width: 300,
            default_height: 300,
            icon_name: "phone"
        });
        
        this.device = device;
        
        // User name
        this.user_name = GLib.get_real_name();
        if (this.user_name === "Unknown") {
            this.user_name = GLib.get_user_name();
        }
        
        // Contact Entry
        this.contactEntry = new ContactEntry();
        this.device.bind_property(
            "reachable",
            this.contactEntry,
            "sensitive",
            GObject.BindingFlags.DEFAULT
        );
        
        // HeaderBar
        this.set_titlebar(
            new Gtk.HeaderBar({
                custom_title: this.contactEntry,
                show_close_button: true
            })
        );
        
        // Content
        this.layout = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            margin: 6,
            spacing: 6
        });
        this.add(this.layout);
        
        // InfoBar
        this.infoBar = new Gtk.InfoBar({
            message_type: Gtk.MessageType.WARNING
        });
        this.infoBar.get_content_area().add(
            new Gtk.Image({ icon_name: "dialog-warning-symbolic" })
        );
        this.infoBar.get_content_area().add(
            new Gtk.Label({ label: _("Device is offline") })
        );
        
        // Content -> Conversation View
        // TODO: intercept notifications to fake a two-way conversation
        let scrolledWindow = new Gtk.ScrolledWindow({
            can_focus: false,
            hexpand: true,
            vexpand: true
        });
        this.layout.add(scrolledWindow);
        
        let conversationFrame = new Gtk.Frame();
        scrolledWindow.add(conversationFrame);
        
        this.conversationBuffer = new Gtk.TextBuffer();
        
        let conversationView = new Gtk.TextView({
            hexpand: true,
            vexpand: true,
            cursor_visible: false,
            editable: false,
            wrap_mode: Gtk.WrapMode.WORD,
            buffer: this.conversationBuffer
        });
        
        this.device.bind_property(
            "reachable",
            conversationView,
            "sensitive",
            GObject.BindingFlags.DEFAULT
        );
        conversationFrame.add(conversationView);
        
        // Content -> Message Entry
        this.messageEntry = new Gtk.Entry({
            hexpand: true,
            placeholder_text: _("Type message here..."),
            //secondary_icon_name: "mail-reply-sender-symbolic",
            secondary_icon_pixbuf: SVG_ACTION_SEND,
            secondary_icon_activatable: true,
            secondary_icon_sensitive: false
        });
        
        this.messageEntry.connect("changed", (entry, signal_id, data) => {
            entry.secondary_icon_sensitive = (entry.text.length) ? true : false;
        });
        
        this.messageEntry.connect("activate", (entry, signal_id, data) => {
            this.send(entry, signal_id, data);
        });
        
        this.messageEntry.connect("icon-release", (entry, signal_id, data) => {
            this.send(entry, signal_id, data);
        });
        
        this.device.bind_property(
            "reachable",
            this.messageEntry,
            "sensitive",
            GObject.BindingFlags.DEFAULT
        );
        
        this.layout.add(this.messageEntry);
        
        // Device Status
        // See: https://bugzilla.gnome.org/show_bug.cgi?id=710888
        this.device.connect("notify::reachable", () => {
            if (!this.device.reachable) {
                this.layout.add(this.infoBar);
                this.layout.reorder_child(this.infoBar, 0);
                this.infoBar.show_all();
            } else if (this.device.reachable) {
                this.infoBar.hide();
                this.layout.remove(this.infoBar);
            }
        });
        
        // Finish initing
        this.show_all();
        this.has_focus = true;
    },
    
    /** Return a list of phone numbers that the SMS will be sent to */
    send: function (entry, signal_id, event) {
        let contactItems = this.contactEntry.text.split(",").filter((s) => {
            return /\S/.test(s);
        });
        let contactNumbers = [];
        let styleContext = this.contactEntry.get_style_context();
        let model = this.contactEntry.get_completion().get_model();
        
        for (let item of contactItems) {
            item = item.trim();
            let contactNumber = false;
            
            // Search the completion (if present) for an exact contact match
            model.foreach((model, path, iter) => {
                if (item === model.get_value(iter, 1)) {
                    contactNumber = model.get_value(iter, 2);
                    return true;
                }
                
                contactNumber = false;
            });
            
            // Found a matching Contact
            if (contactNumber) {
                contactNumbers.push(contactNumber);
            // No matching Contact, but includes alpha characters
            } else if (/[a-zA-Z]/.test(item)) {
                let start = this.contactEntry.text.indexOf(item);
                let end = start + item.length;
                
                this.contactEntry.has_focus = true;
                this.contactEntry.secondary_icon_name = "dialog-error-symbolic";
                this.contactEntry.select_region(start, end);
                
                if (!styleContext.has_class("error")) {
                    styleContext.add_class("error");
                }
                
                return false;
            // Anything else can be handled by the device (libphonenumber)
            } else {
                contactNumbers.push(item);
            }
        }
        
        if (!contactNumbers.length) {
            this.contactEntry.has_focus = true;
            this.contactEntry.secondary_icon_name = "dialog-error-symbolic";
            
            if (!styleContext.has_class("error")) {
                styleContext.add_class("error");
            }
            
            return false;
        }
        
        // Send to each contactNumber
        for (let number of contactNumbers) {
            this.device.sms(number, entry.text);
        }
        
        // Log the sent message in the Conversation View and clear the entry
        let message = "<b>" + this.user_name + ":</b> " + entry.text + "\n";
        this.conversationBuffer.insert_markup(
            this.conversationBuffer.get_end_iter(),
            message,
            message.length
        );
        entry.text = "";
    }
});

const Application = new Lang.Class({
    Name: "Application",
    Extends: Gtk.Application,

    _init: function() {
        this.parent({
            application_id: "org.gnome.shell.extensions.mconnect.sms",
            flags: Gio.ApplicationFlags.FLAGS_NONE,
            register_session: true
        });
        
        let application_name = _("MConnect SMS");

        GLib.set_prgname(application_name);
        GLib.set_application_name(application_name);
        
        this._id = null;
        
        // Options
        this.add_main_option(
            "device",
            "d".charCodeAt(0),
            GLib.OptionFlags.NONE,
            GLib.OptionArg.STRING,
            "Device ID",
            "<device-id>"
        );
    },

    vfunc_startup: function() {
        this.parent();
        
        if (Settings.get_enum("service-provider") === ServiceProvider.MCONNECT) {
            this.manager = new MConnect.DeviceManager();
        } else {
            this.manager = new KDEConnect.DeviceManager();
        }
    },

    vfunc_activate: function() {
        let device;
        
        for (let dbusPath in this.manager.devices) {
            let dev = this.manager.devices[dbusPath];
            
            if (dev.id === this._id && dev.hasOwnProperty("telephony")) {
                device = dev;
            }
        }
        
        if (device === undefined) {
            throw Error("Device is unreachable or doesn't support sending SMS");
        }
        
        let windows = this.get_windows();
        let window = false;
        
        for (let index_ in windows) {
            if (device.id === windows[index_].device.id) {
                window = windows[index_];
            }
        }
        
        if (!window) { window = new ApplicationWindow(this, device); }
        
        window.present();
    },
    
    vfunc_handle_local_options: function(options) {
        if (options.contains("device")) {
            this._id = options.lookup_value("device", null).deep_unpack();
            return -1;
        }
        
        throw Error("Device ID not specified");
        return 1;
    },

    vfunc_shutdown: function() {
        this.parent();
        
        this.manager.destroy();
        delete this.manager;
    }
});

(new Application()).run([System.programInvocationName].concat(ARGV));

