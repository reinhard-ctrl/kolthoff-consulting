/** Embeds a legacy HTML admin tool inside the SPA shell (same-origin iframe). */
export default function LegacyToolFrame({ src, title }: { src: string; title: string }) {
  const url = `${src}${src.includes('?') ? '&' : '?'}embedded=1`;
  return (
    <div className="-m-6 flex flex-col h-[calc(100vh)]">
      <iframe
        src={url}
        title={title}
        className="flex-1 w-full border-0 bg-brandNavy-955"
      />
    </div>
  );
}
