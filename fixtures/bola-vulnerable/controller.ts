export async function getOrder(req, res) {
  const id = req.params.id;
  const order = await Order.findByPk(id);
  return res.json(order);
}
