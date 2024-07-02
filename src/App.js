import React, { useState, useRef, useEffect } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import axios from 'axios';
import { format, parseISO } from 'date-fns';
import logo from './assets/DROPI-PNG-LOGO.png';
import './App.css';

const getFormattedDate = (dateString) => {
  const date = parseISO(dateString);
  return format(date, 'dd-MM-yyyy');
};

const getCurrentDate = () => {
  const now = new Date();
  return format(now, 'yyyy-MM-dd');
};

const getTransportadora = (codigo) => {
  if (!codigo || typeof codigo !== 'string') {
    return 'DESCONOCIDO';
  }

  if (codigo.startsWith('0240')) return 'ENVIA';
  if (codigo.startsWith('219') || codigo.startsWith('220') || codigo.startsWith('221')) return 'SERVIENTREGA';
  if (codigo.startsWith('2400')) return 'INTERRAPIDISIMO';
  if (codigo.startsWith('363')) return 'COORDINADORA';
  if (codigo.startsWith('609')) return 'TCC';
  if (codigo.startsWith('859')) return 'DOMINA';
  // if (/^\d{10}$/.test(codigo)) return '99MINUTOS'; // Si tiene exactamente 10 dígitos y no coincide con ningún otro patrón
  return 'DESCONOCIDO';
};

const sanitizeCodigo = (codigo) => {
  if (!codigo || typeof codigo !== 'string') return '';
  
  if (codigo.startsWith('7363') && codigo.endsWith('001')) {
    return codigo.slice(1, -3);
  }
  return codigo;
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
  const [filterTransportadora, setFilterTransportadora] = useState('');
  const [allRegistros, setAllRegistros] = useState([]); // Para almacenar todos los registros sin filtrar
  const [editTransportadoraId, setEditTransportadoraId] = useState(null); // Para manejar el ID del registro a editar
  const [newTransportadora, setNewTransportadora] = useState(''); // Para manejar la nueva transportadora seleccionada
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current.focus();
    fetchRegistros(searchDate);
    fetchAllRegistros();
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

  const fetchAllRegistros = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/registros');
      const formattedRegistros = response.data.map((registro) => ({
        ...registro,
        fecha: getFormattedDate(registro.fecha),
      }));
      setAllRegistros(formattedRegistros);
    } catch (err) {
      console.error('Error al obtener todos los registros:', err);
    }
  };

  const handleScan = (event) => {
    setCodigo(event.target.value);
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (codigo && codigo.trim() !== '') {
      const sanitizedCodigo = sanitizeCodigo(codigo);
      if (sanitizedCodigo === '') {
        setError('El código es inválido');
        return;
      }

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
    try {
      await axios.delete(`http://localhost:3001/api/registros/${id}`);
      setRegistros((prevRegistros) => prevRegistros.filter((registro) => registro.id !== id));
      setCurrentPage(1); // Reset to page 1 on delete
    } catch (err) {
      console.error('Error al eliminar el registro:', err);
    }
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

  const updateTransportadora = async (id, newTransportadora) => {
    console.log(`Updating transportadora for ID ${id} to ${newTransportadora}`);
    try {
      const response = await axios.put(`http://localhost:3001/api/registros/${id}`, {
        transportadora: newTransportadora,
      });
      setRegistros((prevRegistros) =>
        prevRegistros.map((registro) =>
          registro.id === id ? { ...registro, transportadora: response.data.transportadora } : registro
        )
      );
      setEditTransportadoraId(null); // Reset edit mode
      setNewTransportadora(''); // Clear new transportadora state
    } catch (err) {
      console.error('Error al actualizar la transportadora:', err);
    }
  };
  
  const handleUpdateTransportadora = (id) => {
    setEditTransportadoraId(id); // Set edit mode to the selected record
  };

  const handleSaveTransportadora = (id) => {
    updateTransportadora(id, newTransportadora);
  };

  const imprimirManifiesto = () => {
    const doc = new jsPDF({
      orientation: 'portrait', // Orientación de la página
      unit: 'pt', // Unidad de medida
      format: 'letter' // Tamaño de la página
    });
  
    const fecha = getFormattedDate(searchDate);
    const registrosPorPagina = 20 * 6;
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
  
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
      const totalRegistrosDeTransportadora = registrosDeTransportadora.length;
      const totalPaginas = Math.ceil(totalRegistrosDeTransportadora / registrosPorPagina);
  
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
        doc.text(`PÁGINA ${i + 1} DE ${totalPaginas}`, 10, 20);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
  
        const text = `FECHA MANIFIESTO ${fecha} PARA ${transportadora}`;
  
        const textWidth = doc.getTextWidth(text);
        const textX = (pageWidth - textWidth - 60) / 2; // Ajusta el espacio para el logo
        doc.text(text, textX, 100);
  
        // Añadir el logo a la derecha del texto
        doc.addImage(logo, 'PNG', textX + textWidth + 20, 70, 50, 50); // Ajusta la posición y el tamaño del logo según sea necesario
  
        doc.autoTable({
          startY: 140, // Ajusta la posición de inicio para evitar superposición con el logo y el texto
          head: [['', '', '', '', '', '']],
          body: data,
          theme: 'grid',
          styles: { cellWidth: 95, minCellHeight: 20, halign: 'center', valign: 'middle' },
          headStyles: { fillColor: [255, 255, 255] },
          footStyles: { fillColor: [255, 255, 255] },
          margin: { top: 10, bottom: 40, left: 10, right: 10 },
        });
  
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('NOMBRE AUXILIAR DE RECOLECCIÓN', 20, pageHeight - 150);
        doc.text('PLACA', 280, pageHeight - 150);
        doc.text('FECHA RECOLECCIÓN', 420, pageHeight - 150);
        doc.text('OBSERVACIONES', 20, pageHeight - 80);
        doc.text(`TOTAL PAQUETES ENTREGADOS ${paginaRegistros.length} DE ${totalRegistrosDeTransportadora}`, 380, pageHeight - 20);
  
        if (
          i < totalPaginas - 1 ||
          Object.keys(registrosPorTransportadora).indexOf(transportadora) < Object.keys(registrosPorTransportadora).length - 1
        ) {
          doc.addPage();
        }
      }
    }
  
    doc.save(`${searchDate}.pdf`);
  };
  
  const contarTransportadoras = () => {
    const registrosFiltrados = registros.filter(registro => registro.fecha === getFormattedDate(searchDate));
    return registrosFiltrados.reduce((acc, registro) => {
      acc[registro.transportadora] = (acc[registro.transportadora] || 0) + 1;
      return acc;
    }, {});
  };

  const contadores = contarTransportadoras();

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  // Nueva lógica de búsqueda y paginación
  useEffect(() => {
    if (searchTerm) {
      const searchIndex = allRegistros.findIndex(registro =>
        registro.codigo.toLowerCase().includes(searchTerm.toLowerCase())
      );
      if (searchIndex !== -1) {
        const newPage = Math.floor(searchIndex / itemsPerPage) + 1;
        setCurrentPage(newPage);
      }
    }
  }, [searchTerm, allRegistros, itemsPerPage]);

// Ordenar los registros por ID de mayor a menor
const sortedRegistros = [...registros].sort((a, b) => b.id - a.id);

const filteredRegistros = searchTerm
  ? allRegistros.filter(
      (registro) =>
        registro.codigo.toLowerCase().includes(searchTerm.toLowerCase()) &&
        (!filterTransportadora || registro.transportadora === filterTransportadora)
    ).sort((a, b) => b.id - a.id) // Asegurar que los registros filtrados también estén ordenados
  : registros.filter(
      (registro) =>
        registro.fecha === getFormattedDate(searchDate) &&
        (!filterTransportadora || registro.transportadora === filterTransportadora)
    ).sort((a, b) => b.id - a.id); // Asegurar que los registros filtrados también estén ordenados


  const totalPages = Math.ceil(filteredRegistros.length / itemsPerPage);

  // Paginación de registros
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredRegistros.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <div className="App">
      <div className="counters">
        <p className="red">ENVIA: {contadores.ENVIA || 0}</p>
        <p className="green">SERVIENTREGA: {contadores.SERVIENTREGA || 0}</p>
        <p className="blue">COORDINADORA: {contadores.COORDINADORA || 0}</p>
        <p className="orange">INTERRAPIDISIMO: {contadores.INTERRAPIDISIMO || 0}</p>
        <p className="yellow">TCC: {contadores.TCC || 0}</p>
        <p className="half-yellow-half-blue">
          <span className="half-yellow">DOM</span><span className="half-blue">INA: {contadores.DOMINA || 0}</span>
        </p>
        <p className="half-green-half-white">
          <span className="half-green">99M</span><span className="half-white">INUTOS: {contadores["99MINUTOS"] || 0}</span>
        </p>
        <p className="unknown">DESCONOCIDO: {contadores.DESCONOCIDO || 0}</p>
      </div>
      <div className="controls" style={{ position: 'absolute', top: 10, right: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
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
      </div>
      <div style={{ position: 'absolute', top: 10, right: 230, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <input
          type="text"
          placeholder="Buscar registros"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ display: 'block', marginBottom: '10px', width: '200px' }}
        />
        <input
          type="date"
          value={searchDate}
          onChange={(e) => setSearchDate(e.target.value)}
          style={{ display: 'block', width: '200px' }}
        />
        <select 
          value={filterTransportadora}
          onChange={(e) => setFilterTransportadora(e.target.value)}
          style={{ display: 'block', width: '200px' }}
        >
          <option value="">Todas las Transportadoras</option>
          <option value="ENVIA">ENVIA</option>
          <option value="SERVIENTREGA">SERVIENTREGA</option>
          <option value="COORDINADORA">COORDINADORA</option>
          <option value="INTERRAPIDISIMO">INTERRAPIDISIMO</option>
          <option value="TCC">TCC</option>
          <option value="DOMINA">DOMINA</option>
          <option value="99MINUTOS">99MINUTOS</option>
          <option value="DESCONOCIDO">DESCONOCIDO</option>
        </select>
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
          {currentItems.map((registro) => (
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
                {editTransportadoraId === registro.id ? (
                  <>
                    <select
                      value={newTransportadora}
                      onChange={(e) => setNewTransportadora(e.target.value)}
                    >
                      <option value="">Seleccionar Transportadora</option>
                      <option value="ENVIA">ENVIA</option>
                      <option value="SERVIENTREGA">SERVIENTREGA</option>
                      <option value="COORDINADORA">COORDINADORA</option>
                      <option value="INTERRAPIDISIMO">INTERRAPIDISIMO</option>
                      <option value="TCC">TCC</option>
                      <option value="DOMINA">DOMINA</option>
                      <option value="99MINUTOS">99MINUTOS</option>
                      <option value="DESCONOCIDO">DESCONOCIDO</option>
                    </select>
                    <button
                      style={{ marginLeft: '10px' }}
                      onClick={() => handleSaveTransportadora(registro.id)}
                    >
                      Guardar
                    </button>
                  </>
                ) : (
                  <button
                    style={{ marginLeft: '10px' }}
                    onClick={() => handleUpdateTransportadora(registro.id)}
                  >
                    Editar
                  </button>
                )}
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
