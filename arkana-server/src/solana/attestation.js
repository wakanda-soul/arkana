#!/usr/bin/env node
/**
 * Arkana Cryptographic Treasury Attestation Tool
 * 
 * Provides offline Master Authority signing for Arkana's Treasury Address.
 * Ensures that even if the backend server is compromised, an attacker cannot
 * change the treasury destination wallet without the Founder's Offline Master Private Key.
 */

const path = require('path');
const crypto = require('crypto');

// Resolve bs58 and noble curves from arkana-app or server node_modules
let bs58, ed25519;
try {
  bs58 = require(path.join(__dirname, '..', '..', '..', 'arkana-app', 'node_modules', 'bs58'));
  ed25519 = require(path.join(__dirname, '..', '..', '..', 'arkana-app', 'node_modules', '@noble', 'curves', 'ed25519')).ed25519;
} catch (e) {
  try {
    bs58 = require('bs58');
    ed25519 = require('@noble/curves/ed25519').ed25519;
  } catch (err) {
    console.error('Error loading cryptographic dependencies (bs58, @noble/curves):', err.message);
    process.exit(1);
  }
}

const ATTESTATION_PREFIX = 'ARKANA::TREASURY::ATTESTATION::v1::';

function buildMessage(treasuryAddress) {
  return Buffer.from(`${ATTESTATION_PREFIX}${treasuryAddress}`, 'utf-8');
}

function generateKeys() {
  const privBytes = crypto.randomBytes(32);
  const pubBytes = ed25519.getPublicKey(privBytes);
  const privB58 = bs58.encode(privBytes);
  const pubB58 = bs58.encode(pubBytes);

  console.log('\n======================================================');
  console.log('🔮 ARKANA FOUNDER MASTER KEYPAIR GENERATED');
  console.log('======================================================');
  console.log('PUBLIC KEY (Embed in Mobile App Client):');
  console.log(`  ${pubB58}`);
  console.log('\nPRIVATE KEY (KEEP OFFLINE! NEVER COMMIT OR PUT ON SERVER):');
  console.log(`  ${privB58}`);
  console.log('======================================================\n');
  return { privB58, pubB58 };
}

function signTreasury(treasuryAddress, masterPrivB58) {
  if (!treasuryAddress) {
    console.error('Usage: node treasury-attestation.js sign <treasuryAddress> <masterPrivateKeyBase58>');
    process.exit(1);
  }
  const privBytes = bs58.decode(masterPrivB58);
  const pubBytes = ed25519.getPublicKey(privBytes);
  const pubB58 = bs58.encode(pubBytes);

  const msg = buildMessage(treasuryAddress);
  const sigBytes = ed25519.sign(msg, privBytes);
  const sigB58 = bs58.encode(sigBytes);

  // Self-verify
  const verified = ed25519.verify(sigBytes, msg, pubBytes);
  if (!verified) {
    console.error('Self-verification failed! Aborting.');
    process.exit(1);
  }

  const payload = {
    treasuryAddress,
    attestationSignature: sigB58,
    masterPublicKey: pubB58,
    version: 1,
    signedAt: new Date().toISOString()
  };

  console.log('\n======================================================');
  console.log('✅ TREASURY ATTESTATION SIGNED SUCCESSFULLY');
  console.log('======================================================');
  console.log('Treasury Address:  ', treasuryAddress);
  console.log('Master Public Key: ', pubB58);
  console.log('Attestation Sig:   ', sigB58);
  console.log('\nJSON Payload for economy_config.json:');
  console.log(JSON.stringify(payload, null, 2));
  console.log('======================================================\n');
  return payload;
}

function verifyTreasury(treasuryAddress, sigB58, masterPubB58) {
  try {
    const pubBytes = bs58.decode(masterPubB58);
    const sigBytes = bs58.decode(sigB58);
    const msg = buildMessage(treasuryAddress);
    const isValid = ed25519.verify(sigBytes, msg, pubBytes);
    console.log(`Verification result for ${treasuryAddress}: ${isValid ? 'VALID ✅' : 'INVALID ❌'}`);
    return isValid;
  } catch (err) {
    console.error('Verification error:', err.message);
    return false;
  }
}

const args = process.argv.slice(2);
const cmd = args[0];

if (cmd === 'generate-keys') {
  generateKeys();
} else if (cmd === 'sign') {
  signTreasury(args[1], args[2]);
} else if (cmd === 'verify') {
  verifyTreasury(args[1], args[2], args[3]);
} else {
  console.log('Arkana Treasury Attestation Tool');
  console.log('Commands:');
  console.log('  node treasury-attestation.js generate-keys');
  console.log('  node treasury-attestation.js sign <treasuryAddress> <masterPrivateKeyBase58>');
  console.log('  node treasury-attestation.js verify <treasuryAddress> <signatureBase58> <masterPublicKeyBase58>');
}

module.exports = {
  buildMessage,
  signTreasury,
  verifyTreasury,
  generateKeys
};
