# Show Unit Overview

Shows the kind of unit (service, timer, socket and so on) and its description, every section with the number of settings in it, the dependencies (Requires, Wants, BindsTo, PartOf, After, Before, Conflicts, WantedBy, RequiredBy) and every command line the unit runs (ExecStartPre, ExecStart, ExecStartPost, ExecReload, ExecStop, ExecStopPost) with its line number. Lines continued with a backslash are joined the way systemd joins them.

The report opens as a new Markdown document next to your file. Your file is never changed.
