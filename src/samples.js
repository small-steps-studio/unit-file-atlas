'use strict';
// The sample files of the Open Sample commands. All data is invented for this product; it names no real company, person or system.

const SAMPLES = {
 "openSample": {
  "title": "Open Sample File",
  "fileName": "orders-api.service",
  "languageId": "ini",
  "text": "# orders-api.service: an invented example unit with a few deliberate problems\n[Unit]\nDescription=orders api service\nAfter=network-online.target\nRequires=redis.service\n\n[Service]\nType=notify\nUser=svc-orders\nWorkingDirectory=/srv/orders-api\nExecStart=/usr/bin/orders-api --port 8000\nType=simple\nRestart=on-abnormal\nRestartSec=10x\nNoNewPrivileges=yes\nPrivateTmp=sometimes\nPrivateDevices=yes\nProtectSystem=strict\nProtectHome=read-only\nProtectKernelTunables=yes\nProtectKernelModules=yes\nProtectControlGroups=yes\nRestrictSUIDSGID=yes\n\n[Install]\nWantedBy=multi-user.target\n"
 },
 "openSampleTimer": {
  "title": "Open Sample Timer",
  "fileName": "nightly-backup.timer",
  "languageId": "ini",
  "text": "[Unit]\nDescription=Nightly backup\n\n[Timer]\nOnCalendar=*-*-* 02:00:00\nRandomizedDelaySec=10m\n"
 }
};

/** The sample with the given id, or null. */
function sampleFor(id) { return SAMPLES[id] || null; }

module.exports = { sampleFor: sampleFor, SAMPLE_IDS: Object.keys(SAMPLES) };
