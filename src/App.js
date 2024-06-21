// src/App.js
import React, { useState, useRef, useEffect } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import './App.css';

function App() {
  const [codigo, setCodigo] = useState('');
  const [registros, setRegistros] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current.focus();
  }, []);

  const handleScan = (event) => {
    setCodigo(event.target.value);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (codigo.trim() !== '') {
      const nuevoRegistro = {
        id: registros.length + 1,
        codigo,
        fecha: new Date().toLocaleDateString(),
      };
      setRegistros([...registros, nuevoRegistro]);
      setCodigo('');
    }
  };
  const imprimirManifiesto = () => {
    const doc = new jsPDF();
    const fecha = new Date().toLocaleDateString();
    const registrosPorPagina = 20 * 6;

    const registrosPorFecha = registros.reduce((acc, registro) => {
      if (!acc[registro.fecha]) {
        acc[registro.fecha] = [];
      }
      acc[registro.fecha].push(registro);
      return acc;
    }, {});

    let pagina = 1;
    for (const fecha in registrosPorFecha) {
      const registrosDeFecha = registrosPorFecha[fecha];
      const totalPaginas = Math.ceil(registrosDeFecha.length / registrosPorPagina);

      for (let i = 0; i < totalPaginas; i++) {
        const inicio = i * registrosPorPagina;
        const fin = inicio + registrosPorPagina;
        const paginaRegistros = registrosDeFecha.slice(inicio, fin);

        const data = [];
        for (let j = 0; j < 20; j++) {
          const row = [];
          for (let k = 0; k < 6; k++) {
            const registro = paginaRegistros[j * 6 + k];
            row.push(registro ? registro.codigo : '');
          }
          data.push(row);
        }

        doc.text(`PÁGINA ${pagina}`, 10, 10);
        doc.text(`FECHA MANIFIESTO PARA ________________ - ${fecha}`, 40, 10);

        doc.autoTable({
          startY: 20,
          head: [['', '', '', '', '', '']],
          body: data,
          theme: 'grid',
          styles: { cellWidth: 30, minCellHeight: 10, fontSize: 10, halign: 'center' },
          headStyles: { fillColor: [255, 255, 255] },
          footStyles: { fillColor: [255, 255, 255] },
          margin: { top: 10, bottom: 40, left: 10, right: 10 }
        });

        // Añadir el pie de página
        const pageHeight = doc.internal.pageSize.height;
        doc.setFontSize(10);
        // Primera línea del pie de página
        doc.text('NOMBRE AUXILIAR DE RECOLECCIÓN', 10, pageHeight - 50);
        doc.text('PLACA', 100, pageHeight - 50);
        doc.text('FECHA RECOLECCIÓN', 140, pageHeight - 50);
        
        // Segunda línea del pie de página
        doc.text('OBSERVACIONES', 10, pageHeight - 30);
        doc.text(`TOTAL PIEZAS ENTREGADAS: ${registros.length}`, 150, pageHeight - 30);

        if (i < totalPaginas - 1) {
          doc.addPage();
        }

        pagina++;
      }
    }

    doc.save('manifiesto.pdf');
  };


  return (
    <div className="App">
      <h1>Control de Guías</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          ref={inputRef}
          value={codigo}
          onChange={handleScan}
          placeholder="Escanea el código de barras"
        />
        <button type="submit">Añadir</button>
      </form>
      <button onClick={imprimirManifiesto}>Imprimir Manifiesto</button>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Código</th>
            <th>Fecha</th>
          </tr>
        </thead>
        <tbody>
          {registros.map((registro) => (
            <tr key={registro.id}>
              <td>{registro.id}</td>
              <td>{registro.codigo}</td>
              <td>{registro.fecha}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;
