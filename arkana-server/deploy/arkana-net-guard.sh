#!/bin/sh
# Egress guard for the service user: no new connections to loopback, private or link-local
# networks. The API keeps answering on 127.0.0.1 (replies are ESTABLISHED traffic), but neither
# the server nor the AI sandbox it starts can open the Caddy admin API, other local services or
# the cloud metadata endpoint. Run as root before the service starts (ExecStartPre=+...).
set -eu
PATH=/usr/sbin:/usr/bin:/sbin:/bin
USER_NAME=${1:-arkana}

add4() { iptables -C OUTPUT "$@" 2>/dev/null || iptables -I OUTPUT 1 "$@"; }
add6() { ip6tables -C OUTPUT "$@" 2>/dev/null || ip6tables -I OUTPUT 1 "$@"; }

add4 -o lo -m owner --uid-owner "$USER_NAME" -m conntrack --ctstate NEW -j REJECT
for net in 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16 169.254.0.0/16 100.64.0.0/10; do
  add4 -d "$net" -m owner --uid-owner "$USER_NAME" -m conntrack --ctstate NEW -j REJECT
done

add6 -o lo -m owner --uid-owner "$USER_NAME" -m conntrack --ctstate NEW -j REJECT
for net in fc00::/7 fe80::/10; do
  add6 -d "$net" -m owner --uid-owner "$USER_NAME" -m conntrack --ctstate NEW -j REJECT
done
