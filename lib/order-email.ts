import nodemailer from 'nodemailer'
import { getSupabaseServer } from './supabase-server'
import { storeConfig } from './store-config'

const money = (value: number) => `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`

export async function sendOrderConfirmationEmail(orderId: string) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = process.env
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) return { sent: false, configured: false }

  try {
    const supabase = getSupabaseServer()
    const { data: order, error } = await supabase
      .from('orders')
      .select('id,total,shipping,created_at,customers(name,email),order_items(product_name,quantity,unit_price,total)')
      .eq('id', orderId)
      .maybeSingle()

    if (error || !order) return { sent: false, configured: true }

    const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers
    const items = Array.isArray(order.order_items) ? order.order_items : []
    const itemsList = items.map((item: any) => `- ${item.product_name} x${item.quantity} — ${money(item.total)}`).join('\n')
    const orderShortId = String(order.id).slice(0, 8)

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT || 587),
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    })

    if (customer?.email) {
      await transporter.sendMail({
        from: SMTP_FROM || SMTP_USER,
        to: customer.email,
        subject: `Pedido #${orderShortId} confirmado - Alpha Tec`,
        text: `Olá${customer.name ? `, ${customer.name}` : ''}!\n\nSeu pagamento foi confirmado e o pedido #${orderShortId} já está sendo preparado.\n\nItens:\n${itemsList}\n\nFrete: ${money(order.shipping)}\nTotal: ${money(order.total)}\n\nVocê pode acompanhar o status do pedido na sua conta.\n\nObrigado por comprar na Alpha Tec!`,
      })
    }

    await transporter.sendMail({
      from: SMTP_FROM || SMTP_USER,
      to: storeConfig.quoteEmailRecipients.join(', '),
      subject: `Novo pedido pago #${orderShortId}`,
      text: `Pedido #${orderShortId} confirmado.\nCliente: ${customer?.name || 'não informado'} (${customer?.email || 'sem e-mail'})\n\nItens:\n${itemsList}\n\nFrete: ${money(order.shipping)}\nTotal: ${money(order.total)}`,
    })

    return { sent: true, configured: true }
  } catch {
    return { sent: false, configured: true }
  }
}
