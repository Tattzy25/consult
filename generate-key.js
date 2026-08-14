import crypto from 'node:crypto';
import fs from 'node:fs/promises';

// 1. Generate ECDSA P-256 keypair (P-256 is the curve UCP requires)
const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { 
  namedCurve: 'prime256v1'
});

// 2. Export as JWK (JSON Web Key)
const pubJwk = crypto.createPublicKey(publicKey).export({ format: 'jwk' });
const privJwk = crypto.createPrivateKey(privateKey).export({ format: 'jwk' });

// 3. Add UCP required fields to the public key
const kid = `facetimefy-${Date.now()}`;
pubJwk.kid = kid;
pubJwk.use = 'sig';
pubJwk.alg = 'ES256';

console.log('\n✅ PUBLIC KEY (Paste this ENTIRE object into your Worker\'s signing_keys array):');
console.log(JSON.stringify(pubJwk, null, 2));

console.log('\n🔒 PRIVATE KEY (Save this in Cloudflare Secrets. NEVER put this in the profile!):');
console.log(JSON.stringify(privJwk, null, 2));

// 4. Save to local files for convenience
await fs.writeFile('public-key.json', JSON.stringify(pubJwk, null, 2));
await fs.writeFile('private-key.json', JSON.stringify(privJwk, null, 2));
console.log('\n💾 Keys also saved to public-key.json and private-key.json in this folder.');