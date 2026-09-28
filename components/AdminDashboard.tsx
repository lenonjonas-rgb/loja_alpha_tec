import { useEffect, useRef, useState } from 'react'

type PeriodSummary = { count: number; revenue: number }
type DashboardData = {
  periods: { week: PeriodSummary; month: PeriodSummary; year: PeriodSummary }
  convertedOrders: number
  activeCarts: number
  leads: { total: number; technicalVisit: number; monthlyContract: number; won: number; lost: number; contactLost: number }
  topProducts: { name: string; units: number }[]
  monthlyTrend: { key: string; label: string; orders: number; revenue: number }[]
}
type ChartMetric = 'orders' | 'revenue'

const currency = (value: number) => `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [chartMetric, setChartMetric] = useState<ChartMetric>('orders')
  const [error, setError] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    let cancelled = false
    const load = () => fetch('/api/admin/dashboard')
      .then(async (response) => {
        if (!response.ok) throw new Error('Não foi possível carregar os indicadores.')
        return response.json()
      })
      .then((result) => { if (!cancelled) setData(result) })
      .catch((loadError) => { if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os indicadores.') })
    load()
    const interval = setInterval(load, 15000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  useEffect(() => {
    const interval = setInterval(() => setChartMetric((current) => (current === 'orders' ? 'revenue' : 'orders')), 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    function fitToScreen() {
      const element = rootRef.current
      if (!element) return
      if (!document.fullscreenElement) { setScale(1); return }
      const previousTransform = element.style.transform
      element.style.transform = 'none'
      const naturalHeight = element.scrollHeight
      const naturalWidth = element.scrollWidth
      element.style.transform = previousTransform
      const availableHeight = window.innerHeight - 48
      const availableWidth = window.innerWidth - 48
      const heightScale = naturalHeight > availableHeight ? availableHeight / naturalHeight : 1
      const widthScale = naturalWidth > availableWidth ? availableWidth / naturalWidth : 1
      setScale(Math.max(0.4, Math.min(1, heightScale, widthScale)))
    }
    fitToScreen()
    window.addEventListener('resize', fitToScreen)
    document.addEventListener('fullscreenchange', fitToScreen)
    return () => { window.removeEventListener('resize', fitToScreen); document.removeEventListener('fullscreenchange', fitToScreen) }
  }, [data, chartMetric])

  if (error) return <section className="admin-dashboard"><p className="form-status">{error}</p></section>
  if (!data) return <section className="admin-dashboard"><p className="form-hint">Carregando indicadores...</p></section>

  const chartValues = data.monthlyTrend.map((item) => chartMetric === 'orders' ? item.orders : item.revenue)
  const chartMaximum = Math.max(...chartValues, 1)
  const chartPoints = chartValues.map((value, index) => {
    const x = data.monthlyTrend.length <= 1 ? 400 : 40 + (index * 720) / (data.monthlyTrend.length - 1)
    const y = 210 - (value / chartMaximum) * 170
    return `${x},${y}`
  }).join(' ')
  const maxProductUnits = Math.max(...data.topProducts.map((product) => product.units), 1)

  return <div className="admin-dashboard" ref={rootRef} style={{ transform: `scale(${scale})` }}>
    <header className="admin-dashboard-header">
      <div><p className="eyebrow">DESEMPENHO DA LOJA</p><h2>Visão geral</h2></div>
      <p><span className="dashboard-live-badge"><span className="dashboard-live-dot" /> Ao vivo · atualiza a cada 15s</span> Contagens por data de criação. Faturamento e conversões consideram pedidos pagos, sem cancelamentos.</p>
    </header>

    <section className="dashboard-period-grid" aria-label="Pedidos e faturamento por período">
      {([
        ['week', 'Esta semana'],
        ['month', 'Este mês'],
        ['year', 'Este ano'],
      ] as const).map(([period, label]) => <article className="dashboard-period-card" key={period}>
        <h3>{label}</h3>
        <div><span>Pedidos</span><strong>{data.periods[period].count.toLocaleString('pt-BR')}</strong></div>
        <div><span>Faturamento pago</span><strong>{currency(data.periods[period].revenue)}</strong></div>
      </article>)}
    </section>

    <section className="dashboard-quick-grid" aria-label="Conversões e oportunidades">
      <article className="dashboard-quick-card dashboard-converted"><span>Pedidos convertidos neste ano</span><strong>{data.convertedOrders.toLocaleString('pt-BR')}</strong></article>
      <article className="dashboard-quick-card dashboard-carts"><span>Carrinhos aguardando conversão</span><strong>{data.activeCarts.toLocaleString('pt-BR')}</strong><small>Carrinhos salvos com itens</small></article>
      <article className="dashboard-quick-card dashboard-leads-total"><span>Leads neste ano</span><strong>{data.leads.total.toLocaleString('pt-BR')}</strong></article>
    </section>

    <div className="dashboard-detail-grid">
      <section className="dashboard-panel dashboard-chart-panel">
        <div className="dashboard-panel-heading">
          <div><h3>Evolução mensal</h3><p>Valores acumulados em cada mês deste ano.</p></div>
          <div className="dashboard-segmented" role="group" aria-label="Métrica do gráfico">
            <button type="button" className={chartMetric === 'orders' ? 'active' : ''} onClick={() => setChartMetric('orders')}>Pedidos</button>
            <button type="button" className={chartMetric === 'revenue' ? 'active' : ''} onClick={() => setChartMetric('revenue')}>Faturamento</button>
          </div>
        </div>
        <div className="dashboard-chart-wrap">
          <svg className="dashboard-chart" viewBox="0 0 800 240" role="img" aria-label={chartMetric === 'orders' ? 'Evolução mensal de pedidos' : 'Evolução mensal do faturamento pago'}>
            {[40, 82.5, 125, 167.5, 210].map((y) => <line key={y} x1="40" y1={y} x2="760" y2={y} className="dashboard-chart-gridline" />)}
            {chartValues.length > 1 && <polyline points={chartPoints} className="dashboard-chart-line" />}
            {chartValues.map((value, index) => {
              const x = chartValues.length <= 1 ? 400 : 40 + (index * 720) / (chartValues.length - 1)
              const y = 210 - (value / chartMaximum) * 170
              const label = data.monthlyTrend[index].label
              return <circle key={data.monthlyTrend[index].key} cx={x} cy={y} r="5" className="dashboard-chart-point"><title>{`${label}: ${chartMetric === 'orders' ? `${value} pedidos` : currency(value)}`}</title></circle>
            })}
          </svg>
          <div className="dashboard-chart-labels" style={{ gridTemplateColumns: `repeat(${data.monthlyTrend.length}, minmax(0, 1fr))` }}>
            {data.monthlyTrend.map((item) => <span key={item.key}>{item.label.replace('.', '')}</span>)}
          </div>
        </div>
        <p className="dashboard-chart-note">{chartMetric === 'orders' ? 'Pedidos criados por mês' : 'Faturamento de pedidos pagos por mês'}</p>
      </section>

      <section className="dashboard-panel dashboard-products-panel">
        <div className="dashboard-panel-heading"><div><h3>Mais vendidos</h3><p>Unidades em pedidos pagos neste ano.</p></div></div>
        {data.topProducts.length ? <ol className="dashboard-products-list">
          {data.topProducts.map((product, index) => <li key={`${product.name}-${index}`}>
            <div className="dashboard-product-label"><span>{index + 1}. {product.name}</span><strong>{product.units} un.</strong></div>
            <div className="dashboard-product-track"><span style={{ width: `${Math.max(6, (product.units / maxProductUnits) * 100)}%` }} /></div>
          </li>)}
        </ol> : <p className="form-hint">Ainda não há vendas pagas neste ano.</p>}
      </section>
    </div>

    <section className="dashboard-panel dashboard-leads-panel">
      <div className="dashboard-panel-heading"><div><h3>Leads de serviços</h3><p>Solicitações recebidas neste ano.</p></div></div>
      <div className="dashboard-leads-grid">
        <article><span>Visita técnica</span><strong>{data.leads.technicalVisit.toLocaleString('pt-BR')}</strong></article>
        <article><span>Contrato mensal</span><strong>{data.leads.monthlyContract.toLocaleString('pt-BR')}</strong></article>
        <article><span>Ganhos</span><strong>{data.leads.won.toLocaleString('pt-BR')}</strong></article>
        <article><span>Perdas</span><strong>{data.leads.lost.toLocaleString('pt-BR')}</strong></article>
        <article><span>Contato perdido</span><strong>{data.leads.contactLost.toLocaleString('pt-BR')}</strong></article>
      </div>
    </section>
  </div>
}
