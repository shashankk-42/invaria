export async function getOrder(req, res) {
  const order = await Order.findOne({
    where: { id: req.params.id, userId: req.user.id }
  });
  if (!order) return res.status(404).end();
  return res.json(order);
}
