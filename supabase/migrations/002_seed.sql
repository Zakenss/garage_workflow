-- Demo users (password: 1234 for all)
INSERT INTO users (full_name, username, password, role, mechanic_slot) VALUES
  ('Admin Système', 'admin', '1234', 'admin', NULL),
  ('Marie Dupont', 'secretary', '1234', 'secretary', NULL),
  ('Jean Martin', 'manager', '1234', 'workshop_manager', NULL),
  ('Pierre Mécanicien', 'mechanic1', '1234', 'mechanic', 1),
  ('Paul Mécanicien', 'mechanic2', '1234', 'mechanic', 2),
  ('Jacques Mécanicien', 'mechanic3', '1234', 'mechanic', 3),
  ('Sophie Magasin', 'storekeeper', '1234', 'storekeeper', NULL),
  ('Luc Carrossier', 'bodyworker', '1234', 'bodyworker', NULL),
  ('Anne Vendeuse', 'seller', '1234', 'seller', NULL);
