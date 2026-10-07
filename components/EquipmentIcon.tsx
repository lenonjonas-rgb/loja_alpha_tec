export default function EquipmentIcon({ category }: { category: string }) {
  const paths: Record<string, React.ReactNode> = {
    esteiras: <><path d="M5 24h22l-3 5H4zM19 24l-2-17h8M17 7l-3-3" /><circle cx="9" cy="30" r="1" /><circle cx="23" cy="30" r="1" /></>,
    musculacao: <><path d="M4 16h24M6 8v16M10 5v22M22 5v22M26 8v16" /></>,
    bicicletas: <><circle cx="9" cy="23" r="6" /><circle cx="25" cy="23" r="4" /><path d="m9 23 8-10 8 10M17 13l-2-6h5M10 9H5M8 9l9 14M17 23H9M24 7h4l-3 16" /></>,
    elipticos: <><path d="M3 28h26M9 26l5-14M20 26l-4-14M14 12 11 4M16 12l5-8M6 22h7M19 22h7" /><circle cx="15" cy="23" r="4" /></>,
    acessorios: <><path d="m6 26 13-13M7 5l4 4-3 3-4-4a7 7 0 0 0 9 9l10 10 4-4-10-10a7 7 0 0 0-10-8Z" /></>,
  }
  return <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[category]}</svg>
}
