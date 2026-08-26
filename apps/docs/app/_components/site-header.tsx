import Image from "next/image";
import Link from "next/link";

export function SiteHeader(props: {
  current?: "doctor" | "observatory" | "proof" | "smart-wallets";
}) {
  return (
    <header className="topbar">
      <Link className="brand" href="/">
        <Image
          alt=""
          aria-hidden="true"
          className="brand-wordmark"
          height={65}
          priority
          src="/bao-wordmark.png"
          width={172}
        />
        <span>Base Attribution OS</span>
      </Link>
      <nav className="nav-links" aria-label="Primary navigation">
        <Link aria-current={props.current === "doctor" ? "page" : undefined} href="/">
          Doctor
        </Link>
        <Link
          aria-current={props.current === "observatory" ? "page" : undefined}
          href="/observatory"
        >
          Observatory
        </Link>
        <Link
          aria-current={props.current === "smart-wallets" ? "page" : undefined}
          href="/smart-wallets"
        >
          Smart Wallets
        </Link>
        <a
          aria-label="Follow Base Attribution OS on X"
          className="x-button"
          href="https://x.com/BaseAttribution"
          rel="noreferrer"
          target="_blank"
        >
          <XIcon />
          <span>@BaseAttribution</span>
        </a>
        <a className="star-button" href="https://github.com/horn111/base-attribution-os">
          <StarIcon />
          <span>Star repo</span>
        </a>
      </nav>
    </header>
  );
}

function XIcon() {
  return (
    <svg aria-hidden="true" height="12" viewBox="0 0 24 24" width="12">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg aria-hidden="true" height="12" viewBox="0 0 24 24" width="12">
      <path d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.787 1.4 8.168L12 18.896l-7.334 3.857 1.4-8.168L.132 9.21l8.2-1.192z" />
    </svg>
  );
}
