const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = 3001;

const pool = new Pool({
  user: 'postgres', // Reemplaza con tu usuario de PostgreSQL
  host: 'localhost',
  database: 'Pistolon', // Reemplaza con tu base de datos de PostgreSQL
  password: 'Giron1221', // Reemplaza con tu contraseña de PostgreSQL
  port: 5432,
});

app.use(cors());
app.use(bodyParser.json());

app.post('/api/registros', async (req, res) => {
  const { codigo, fecha, transportadora } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO registros (codigo, fecha, transportadora) VALUES ($1, $2, $3) RETURNING *',
      [codigo, fecha, transportadora]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar el registro' });
  }
});

app.get('/api/registros', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM registros');
    res.status(200).json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener los registros' });
  }
});

// Endpoint DELETE para eliminar registros
app.delete('/api/registros/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM registros WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar el registro' });
  }
});

// Agregar el endpoint PUT
app.put('/api/registros/:id', async (req, res) => {
  const { id } = req.params;
  const { transportadora } = req.body;
  try {
    const result = await pool.query(
      'UPDATE registros SET transportadora = $1 WHERE id = $2 RETURNING *',
      [transportadora, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar el registro' });
  }
});

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${3001}`);
});
