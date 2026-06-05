const packages = [
  ["core", "ERC-8021 encode, decode, append, validate"],
  ["viem", "dataSuffix and client helpers"],
  ["wagmi", "config and hook helpers"],
  ["cli", "bao validation commands"],
  ["github-action", "PR enforcement wrapper"],
];

export default function Page() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Builder Codes in SDKs and CI</p>
        <h1>Base Attribution OS</h1>
        <p className="lede">
          Add, validate, and enforce Base Builder Code attribution across viem, wagmi, wallets,
          agents, and pull requests.
        </p>
        <div className="commands">
          <code>pnpm bao encode --code bc_abc123</code>
          <code>pnpm bao scan-repo --path . --builder-code bc_abc123</code>
        </div>
      </section>

      <section className="grid">
        {packages.map(([name, description]) => (
          <article key={name}>
            <h2>@base-attribution-os/{name}</h2>
            <p>{description}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
