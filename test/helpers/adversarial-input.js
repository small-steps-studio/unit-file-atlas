'use strict';
// Hostile and odd unit files for the adversarial test (invented; the payloads must come out as plain escaped text).
const PAY = ['x | <b>y</b> [link](https://evil.test)', '![t](https://evil.test/p.png)', '<img src=https://evil.test/i.png>', '`code` *b* _i_ ~s~ # h', '<script>alert(1)</script>', 'a|b|c', 'Cost $5 and $x$ here', '\\| escaped'];
const cases = [];
PAY.forEach((p, i) => {
  cases.push({ name: 'description ' + i, text: '[Unit]\nDescription=' + p + '\nAfter=' + p + '\n[Service]\nExecStart=/usr/bin/app ' + p + '\nUser=' + p + '\nRestartSec=' + p + '\nPrivateTmp=' + p + '\nType=' + p + '\nRestart=' + p + '\nType=simple\n[Install]\nWantedBy=' + p + '\n' });
  cases.push({ name: 'section and key ' + i, text: '[' + p + ']\n' + p.replace(/=/g, '') + 'Key=1\n[Service]\nExecStart=/bin/true\n' });
  cases.push({ name: 'continuation ' + i, text: '[Service]\nExecStart=/bin/sh -c \\\n  "' + p + '"\n' });
  cases.push({ name: 'restart delay ' + i, text: '[Unit]\nDescription=' + p + '!\nAfter=network-online.target ' + p + '\n[Service]\nExecStart=/bin/a\nRestart=always\nRestartSec=' + p + '\nPrivateTmp=' + p + '\nProtectControlGroups=' + p + '\n[Install]\nAlias=' + p + '\n' });
  cases.push({ name: 'crlf comment continuation ' + i, text: '[Service]\r\nExecStart=/bin/a \\\r\n# ' + p + '\r\n  "' + p + '" \\\r\n; ' + p + '\r\n  -v\r\n' });
});
cases.push({ name: 'only junk', text: '\u0000\u0001[[[]]]===\n' });
cases.push({ name: 'huge line', text: '[Service]\nExecStart=' + 'x'.repeat(200000) + '\n' });
module.exports = { cases };
