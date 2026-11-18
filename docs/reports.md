# Reports

Every report reads the text of the active editor and opens its result as a new Markdown document. Your file is never changed and nothing is sent anywhere. The examples below come from the sample file (Open Sample File).

## Show Unit Overview

Command: **Unit File Atlas: Show Unit Overview**

Shows the kind of unit (service, timer, socket and so on) and its description, every section with the number of settings in it, the dependencies (Requires, Wants, BindsTo, PartOf, After, Before, Conflicts, WantedBy, RequiredBy) and every command line the unit runs (ExecStartPre, ExecStart, ExecStartPost, ExecReload, ExecStop, ExecStopPost) with its line number. Lines continued with a backslash are joined the way systemd joins them.

Example (sample file):

> # Unit Overview
>
> service unit: orders api service.
>
> | Section | Line | Entries |
> | --- | --- | --- |
> | Unit | 2 | 3 |
> | Service | 7 | 16 |
> | Install | 25 | 1 |
>
> ## Dependencies
>
> | Directive | Units |
> | --- | --- |
> | Requires | redis.service |
> | After | network-online.target |
> | WantedBy | multi-user.target |
>
> ## Commands
>
> | Directive | Line | Command |
> | --- | --- | --- |
> | ExecStart | 11 | /usr/bin/orders-api --port 8000 |
>

## Show Syntax Check

Command: **Unit File Atlas: Show Syntax Check**

Finds the structural mistakes systemd silently skips or reads differently than intended: settings before the first section, lines without an equals sign, misspelled section names (custom X- sections are allowed), and settings that may appear only once but appear again, in which case systemd uses the last value.

Example (sample file):

> # Syntax Check
>
> 1 problem found.
>
> | Line | Problem |
> | --- | --- |
> | 12 | Type is set again (first on line 8); the last value wins |
>

## Show Value Check

Command: **Unit File Atlas: Show Value Check**

Checks the values of common settings: yes/no settings such as PrivateTmp and NoNewPrivileges, time spans such as RestartSec and TimeoutStartSec (5s, 1min 30s, 2 h, 55s500ms, 100ms, infinity and so on), the service Type= and the Restart= policy of the [Service] section. Each invalid value is listed with its line.

Example (sample file):

> # Value Check
>
> 2 invalid values.
>
> | Line | Problem |
> | --- | --- |
> | 14 | RestartSec=10x is not a valid time span |
> | 16 | PrivateTmp=sometimes is not a boolean or disconnected |
>

## Show Service Hardening (Pro)

Command: **Unit File Atlas: Show Service Hardening** (Pro; part of the 14-day trial)

Lists 15 sandboxing settings of systemd for the service, its current value and the recommended value, and counts how many are applied: a non-root user (or DynamicUser), NoNewPrivileges, PrivateTmp, PrivateDevices, ProtectSystem, ProtectHome, the kernel and control-group protections, RestrictSUIDSGID, LockPersonality, MemoryDenyWriteExecute, RestrictRealtime, CapabilityBoundingSet and SystemCallFilter. The checklist is modelled on the settings systemd-analyze security looks at; it is a checklist, not systemd's own score.

Example (sample file):

> # Service Hardening
>
> 9 of 15 hardening settings applied.
>
> | Setting | Current | Recommended | Applied |
> | --- | --- | --- | --- |
> | User | svc-orders | a non-root user or DynamicUser=yes | yes |
> | NoNewPrivileges | yes | yes | yes |
> | PrivateTmp | sometimes | yes | no |
> | PrivateDevices | yes | yes | yes |
> | ProtectSystem | strict | strict | yes |
> | ProtectHome | read-only | yes | yes |
> | ProtectKernelTunables | yes | yes | yes |
> | ProtectKernelModules | yes | yes | yes |
> | ProtectControlGroups | yes | yes | yes |
> | RestrictSUIDSGID | yes | yes | yes |
> | LockPersonality | - | yes | no |
> | MemoryDenyWriteExecute | - | yes | no |
> | RestrictRealtime | - | yes | no |
> | CapabilityBoundingSet | - | only the capabilities the service needs | no |
> | SystemCallFilter | - | @system-service | no |
>

## Show Reliability Check (Pro)

Command: **Unit File Atlas: Show Reliability Check** (Pro; part of the 14-day trial)

Finds settings that work on a test machine and fail in production: a service that is not restarted when it fails, a restart with a missing or invalid RestartSec, After=network-online.target without Wants=network-online.target, Type=forking without a PIDFile, a unit that cannot be enabled because [Install] has no WantedBy=, several ExecStart= lines outside Type=oneshot, and OnCalendar timers without Persistent=true that skip the runs missed while the machine was off.

Example (sample file):

> # Reliability Check
>
> 2 findings.
>
> | Line | Rule | Finding |
> | --- | --- | --- |
> | 4 | Network ordering | After=network-online.target without Wants=network-online.target does not pull the target in |
> | 14 | Restart delay | RestartSec=10x is not a valid time span: the default of 100 ms applies and the service may hit the start limit |
>
