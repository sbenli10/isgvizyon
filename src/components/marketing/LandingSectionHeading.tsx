type LandingSectionHeadingProps = {
  eyebrow: string;
  title: string;
  description: string;
  align?: "left" | "center";
};

export function LandingSectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
}: LandingSectionHeadingProps) {
  const isCenter = align === "center";

  return (
    <div className={isCenter ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
        {eyebrow}
      </p>
      <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-base leading-8 text-slate-300 sm:text-lg">
        {description}
      </p>
    </div>
  );
}
