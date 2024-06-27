import React, { useState, useRef, useEffect } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import axios from 'axios';
import { format, parseISO } from 'date-fns';
import logo from './assets/DROPI-PNG-LOGO.png'; // Asegúrate de ajustar la ruta
import './App.css';

const getFormattedDate = (dateString) => {
  const date = parseISO(dateString);
  return format(date, 'dd-MM-yyyy');
};

const getCurrentDate = () => {
  const now = new Date();
  return format(now, 'yyyy-MM-dd');
};

function App() {
  const [codigo, setCodigo] = useState('');
  const [registros, setRegistros] = useState([]);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [multiCodes, setMultiCodes] = useState('');
  const [searchDate, setSearchDate] = useState(getCurrentDate());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(100);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current.focus();
    fetchRegistros(searchDate);
  }, [searchDate]);

  const fetchRegistros = async (fecha) => {
    try {
      const response = await axios.get('http://localhost:3001/api/registros', { params: { fecha } });
      const formattedRegistros = response.data.map((registro) => ({
        ...registro,
        fecha: getFormattedDate(registro.fecha),
      }));
      setRegistros(formattedRegistros);
      setCurrentPage(1); // Reset current page on new data fetch
    } catch (err) {
      console.error('Error al obtener los registros:', err);
    }
  };

  const handleScan = (event) => {
    setCodigo(event.target.value);
    setError('');
  };

  const sanitizeCodigo = (codigo) => {
    if (codigo.startsWith('7363') && codigo.endsWith('001')) {
      return codigo.slice(1, -3);
    }
    return codigo;
  };

  const getTransportadora = (codigo) => {
    if (codigo.startsWith('0240')) return 'ENVIA';
    if (codigo.startsWith('219') || codigo.startsWith('220') || codigo.starts.startsWith('221')) return 'SERVIENTREGA';
    if (codigo.startsWith('2400')) return 'INTERRAPIDISIMO';
    if (codigo.startsWith('363')) return 'COORDINADORA';
    return 'DESCONOCIDO';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (codigo.trim() !== '') {
      const sanitizedCodigo = sanitizeCodigo(codigo);
      const codigoExistente = registros.some((registro) => registro.codigo === sanitizedCodigo);

      if (codigoExistente) {
        setError('El código ya existe en los registros');
      } else {
        const nuevoRegistro = {
          codigo: sanitizedCodigo,
          fecha: getCurrentDate(),
          transportadora: getTransportadora(sanitizedCodigo),
        };
        try {
          const response = await axios.post('http://localhost:3001/api/registros', nuevoRegistro);
          setRegistros([...registros, { ...response.data, fecha: getFormattedDate(response.data.fecha) }]);
          setCodigo('');
        } catch (err) {
          console.error('Error al guardar el registro:', err);
        }
      }
    }
  };

  const handleDelete = async (id) => {
    // Implementa la lógica para eliminar un registro si es necesario
  };

  const handleMultiSubmit = async () => {
    const codes = multiCodes.split('\n').map((code) => code.trim()).filter((code) => code !== '');
    const newRegistros = codes.map((code) => {
      const sanitizedCodigo = sanitizeCodigo(code);
      return {
        codigo: sanitizedCodigo,
        fecha: getCurrentDate(),
        transportadora: getTransportadora(sanitizedCodigo),
      };
    });

    try {
      for (const registro of newRegistros) {
        const response = await axios.post('http://localhost:3001/api/registros', registro);
        setRegistros((prevRegistros) => [
          ...prevRegistros,
          { ...response.data, fecha: getFormattedDate(response.data.fecha) },
        ]);
      }
      fetchRegistros(searchDate);
      setMultiCodes('');
    } catch (err) {
      console.error('Error al guardar los registros:', err);
    }
  };

  const imprimirManifiesto = () => {
    const doc = new jsPDF();
    const fecha = getFormattedDate(searchDate);
    const registrosPorPagina = 20 * 6;
    const pageWidth = doc.internal.pageSize.width;

    const registrosFiltrados = registros.filter(registro => registro.fecha === getFormattedDate(searchDate));

    const registrosPorTransportadora = registrosFiltrados.reduce((acc, registro) => {
      if (!acc[registro.transportadora]) {
        acc[registro.transportadora] = [];
      }
      acc[registro.transportadora].push(registro);
      return acc;
    }, {});

    for (const transportadora in registrosPorTransportadora) {
      const registrosDeTransportadora = registrosPorTransportadora[transportadora];
      const totalPaginas = Math.ceil(registrosDeTransportadora.length / registrosPorPagina);

      for (let i = 0; i < totalPaginas; i++) {
        const inicio = i * registrosPorPagina;
        const fin = inicio + registrosPorPagina;
        const paginaRegistros = registrosDeTransportadora.slice(inicio, fin);

        const data = [];
        for (let j = 0; j < 20; j++) {
          const row = [];
          for (let k = 0; k < 6; k++) {
            const registro = paginaRegistros[j * 6 + k];
            if (registro) {
              const fontSize = registro.codigo.length >= 14 ? 8 : 10; // Cambia el tamaño de fuente según la longitud del código
              row.push({ content: registro.codigo, styles: { fontSize } });
            } else {
              row.push('');
            }
          }
          data.push(row);
        }

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`PÁGINA ${i + 1} DE ${totalPaginas}`, 10, 10);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');

        const text = `FECHA MANIFIESTO ${fecha} PARA ${transportadora}`;
        const textWidth = doc.getTextWidth(text);
        const textX = (pageWidth - textWidth - 60) / 2; // Ajusta el espacio para el logo
        doc.text(text, textX, 20);

        // Añadir el logo a la derecha del texto
        doc.addImage(logo, 'PNG', textX + textWidth + 10, 10, 50, 20); // Ajusta la posición y el tamaño del logo según sea necesario

        doc.autoTable({
          startY: 30, // Ajusta la posición de inicio para evitar superposición con el logo y el texto
          head: [['', '', '', '', '', '']],
          body: data,
          theme: 'grid',
          styles: { cellWidth: 30, minCellHeight: 10, halign: 'center', valign: 'middle' },
          headStyles: { fillColor: [255, 255, 255] },
          footStyles: { fillColor: [255, 255, 255] },
          margin: { top: 10, bottom: 40, left: 10, right: 10 },
        });

        const pageHeight = doc.internal.pageSize.height;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('NOMBRE AUXILIAR DE RECOLECCIÓN', 10, pageHeight - 50);
        doc.text('PLACA', 100, pageHeight - 50);
        doc.text('FECHA RECOLECCIÓN', 140, pageHeight - 50);
        doc.text('OBSERVACIONES', 10, pageHeight - 30);
        doc.text(`TOTAL PIEZAS ENTREGADAS: ${registrosDeTransportadora.length}`, 140, pageHeight - 10);

        if (
          i < totalPaginas - 1 ||
          Object.keys(registrosPorTransportadora).indexOf(transportadora) < Object.keys(registrosPorTransportadora).length - 1
        ) {
          doc.addPage();
        }
      }
    }

    doc.save('manifiesto.pdf');
  };

  const contarTransportadoras = () => {
    return registros.reduce((acc, registro) => {
      acc[registro.transportadora] = (acc[registro.transportadora] || 0) + 1;
      return acc;
    }, {});
  };

  const contadores = contarTransportadoras();

  const sortedRegistros = [...registros].sort((a, b) => b.id - a.id);


  // Paginación de registros
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = sortedRegistros.slice(indexOfFirstItem, indexOfLastItem);

  const totalPages = Math.ceil(sortedRegistros.length / itemsPerPage);

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const filteredRegistros = currentItems.filter((registro) =>
    registro.codigo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="App">
      <div className="counters">
        <p className="red">ENVIA: {contadores.ENVIA || 0}</p>
        <p className="green">SERVIENTREGA: {contadores.SERVIENTREGA || 0}</p>
        <p className="blue">COORDINADORA: {contadores.COORDINADORA || 0}</p>
        <p className="orange">INTERRAPIDISIMO: {contadores.INTERRAPIDISIMO || 0}</p>
      </div>
      <div className="controls" style={{ position: 'absolute', top: 10, right: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <textarea
            placeholder="Ingrese múltiples códigos, uno por línea"
            value={multiCodes}
            onChange={(e) => setMultiCodes(e.target.value)}
            style={{ width: '200px', height: '100px', display: 'block', marginBottom: '10px' }}
          ></textarea>
          <button onClick={handleMultiSubmit} style={{ display: 'block', marginBottom: '10px' }}>
            Añadir Múltiples Códigos
          </button>
        </div>
        <input
          type="text"
          placeholder="Buscar registros"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <input
          type="date"
          value={searchDate}
          onChange={(e) => setSearchDate(e.target.value)}
          style={{ marginTop: '10px' }}
        />
      </div>
      <h1 className="title">Pistoleo</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '20px' }}>
        <input
          type="text"
          ref={inputRef}
          value={codigo}
          onChange={handleScan}
          placeholder="Escanea el código de barras"
        />
        <button type="submit" style={{ marginLeft: '10px' }}>
          Añadir
        </button>
      </form>
      {error && <p className="error-message">{error}</p>}
      <div style={{ textAlign: 'center', margin: '20px 0' }}>
        <button onClick={imprimirManifiesto}>Imprimir Manifiesto</button>
      </div>

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Código</th>
            <th>Fecha</th>
            <th>Transportadora</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {filteredRegistros.map((registro) => (
            <tr key={registro.id}>
              <td>{registro.id}</td>
              <td>{registro.codigo}</td>
              <td>{registro.fecha}</td>
              <td>{registro.transportadora}</td>
              <td>
                <button
                  style={{ color: 'red' }}
                  onClick={() => handleDelete(registro.id)}
                >
                  X
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pagination">
        {Array.from({ length: totalPages }, (_, index) => (
          <button
            key={index + 1}
            onClick={() => handlePageChange(index + 1)}
            className={index + 1 === currentPage ? 'active' : ''}
          >
            {index + 1}
          </button>
        ))}
      </div>
    </div>
  );
}

export default App;
