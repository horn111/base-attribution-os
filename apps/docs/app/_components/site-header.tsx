import Image from "next/image";
import Link from "next/link";

export function SiteHeader(props: { current?: "doctor" | "observatory" | "proof" }) {
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
        <a className="star-button" href="https://github.com/horn111/base-attribution-os">
          <StarIcon />
          <span>Star repo</span>
        </a>
      </nav>
    </header>
  );
}

function StarIcon() {
  return (
    <svg aria-hidden="true" height="12" viewBox="0 0 24 24" width="12">
      <path d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.787 1.4 8.168L12 18.896l-7.334 3.857 1.4-8.168L.132 9.21l8.2-1.192z" />
    </svg>
  );
}
