import { generateKeyPairSync } from 'crypto';

for (let i = 0; i < 2; i++) {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const pub = publicKey.export({ format: 'jwk' });
  const priv = privateKey.export({ format: 'jwk' });
  const kid = `agent-${Date.now()}${i}`;

  console.log(`===== KEY ${i + 1} =====`);
  console.log('PUBLIC (put this in "signing_keys" in the profile):');
  console.log(JSON.stringify({
    kty: pub.kty,
    x: pub.x,
    y: pub.y,
    crv: pub.crv,
    kid,
    use: 'sig',
    alg: 'ES256'
  }));
  console.log('PRIVATE (KEEP SECRET — use to sign outgoing requests/webhooks):');
  console.log(JSON.stringify(priv));
  console.log('');
}
