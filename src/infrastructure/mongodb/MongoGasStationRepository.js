const { v4: uuidv4 } = require('uuid');
const GasStation = require('../../domain/entities/GasStation');
const { Int32, Double } = require('mongodb');

/**
 * Repositorio para la persistencia de GasStations en MongoDB
 */
class MongoGasStationRepository {
  /**
   * Constructor del repositorio
   * @param {Object} database - Instancia de la base de datos MongoDB
   */
  constructor(database) {
    this.collection = database.collection('gasStations');
  }

  /**
   * Convierte una entidad GasStation a documento MongoDB
   * @param {GasStation} gasStation - Entidad de gasolinera del dominio
   * @returns {Object} Documento para MongoDB
   * @private
   */
  _toDocument(gasStation) {
    // Asegurarse de que los campos tienen los tipos correctos para MongoDB
    const stationNumber = parseInt(gasStation.stationNumber || 0);
    const currentLevel = parseFloat(gasStation.currentLevel || 0);
    const ticketCount = parseInt(gasStation.ticketCount || 0);
    
    // Verificar que son valores válidos
    if (isNaN(stationNumber) || stationNumber <= 0) {
      throw new Error('El número de estación debe ser un número entero positivo');
    }
    
    if (isNaN(currentLevel) || currentLevel < 0) {
      throw new Error('El nivel de combustible debe ser un número no negativo');
    }
    
    if (isNaN(ticketCount) || ticketCount < 0) {
      throw new Error('El contador de tickets debe ser un número entero no negativo');
    }
    
    return {
      _id: gasStation.id || uuidv4(),
      stationNumber: new Int32(stationNumber), // Tipo BSON Int32 para enteros
      name: String(gasStation.name),
      address: String(gasStation.address),
      openTime: new Date(gasStation.openTime), // Ya es tipo Date
      closeTime: new Date(gasStation.closeTime), // Ya es tipo Date
      managerCi: String(gasStation.managerCi),
      currentLevel: new Double(currentLevel), // Tipo BSON Double para decimales
      available: Boolean(currentLevel > 0), // Asegurar que es booleano
      ticketCount: new Int32(ticketCount) // Tipo BSON Int32 para enteros
    };
  }

  /**
   * Convierte un documento MongoDB a entidad GasStation
   * @param {Object} doc - Documento de MongoDB
   * @returns {GasStation} Entidad de gasolinera del dominio
   * @private
   */
  _toEntity(doc) {
    if (!doc) return null;

    return new GasStation({
      id: doc._id,
      stationNumber: doc.stationNumber,
      name: doc.name,
      address: doc.address,
      openTime: doc.openTime,
      closeTime: doc.closeTime,
      managerCi: doc.managerCi,
      currentLevel: doc.currentLevel,
      available: doc.available,
      ticketCount: doc.ticketCount
    });
  }

  /**
   * Mapea un documento de MongoDB a un objeto de dominio GasStation
   * @private
   * @param {Object} doc - Documento de MongoDB
   * @returns {GasStation|null} Objeto de dominio o null si doc es null
   */
  _mapToEntity(doc) {
    if (!doc) return null;
    
    // Convertir el documento de MongoDB a un objeto GasStation
    return new GasStation({
      id: doc._id,
      stationNumber: doc.stationNumber,
      name: doc.name,
      address: doc.address,
      openTime: doc.openTime,
      closeTime: doc.closeTime,
      managerCi: doc.managerCi,
      currentLevel: doc.currentLevel || 0,
      available: doc.available || false,
      ticketCount: doc.ticketCount || 0
    });
  }

  /**
   * Crea una nueva gasolinera en la base de datos
   * @param {GasStation} gasStation - Entidad de gasolinera del dominio
   * @returns {Promise<GasStation>} Gasolinera creada con ID generado
   */
  async create(gasStation) {
    try {
      // Convertir a documento MongoDB
      const doc = this._toDocument(gasStation);
      
      // Insertar en la colección
      await this.collection.insertOne(doc);
      
      // Devolver la entidad con el ID generado
      return this._toEntity(doc);
    } catch (error) {
      console.error('Error al guardar la gasolinera en MongoDB:', error);
      
      // Proporcionar mensajes de error más específicos
      if (error.code === 11000) {
        if (error.keyPattern?.stationNumber) {
          throw new Error(`Ya existe una gasolinera con el número: ${gasStation.stationNumber}`);
        } else if (error.keyPattern?.managerCi) {
          throw new Error(`El administrador con CI: ${gasStation.managerCi} ya tiene una gasolinera asignada`);
        } else {
          throw new Error('Ya existe una gasolinera con estos datos');
        }
      }
      
      throw new Error('Error al guardar la gasolinera: ' + error.message);
    }
  }

  /**
   * Busca una gasolinera por su ID
   * @param {string} id - ID de la gasolinera
   * @returns {Promise<GasStation|null>} Gasolinera encontrada o null
   */
  async findById(id) {
    const doc = await this.collection.findOne({ _id: id });
    return this._toEntity(doc);
  }

  /**
   * Busca una gasolinera por su número
   * @param {number} stationNumber - Número de la gasolinera
   * @returns {Promise<GasStation|null>} Gasolinera encontrada o null
   */
  async findByStationNumber(stationNumber) {
    // Convertir explícitamente a entero para la búsqueda
    const numericStationNumber = parseInt(stationNumber);
    const doc = await this.collection.findOne({ stationNumber: numericStationNumber });
    return this._toEntity(doc);
  }

  /**
   * Busca una gasolinera por el CI del administrador
   * @param {string} managerCi - CI del administrador
   * @returns {Promise<GasStation|null>} Gasolinera encontrada o null
   */
  async findByManagerCI(managerCi) {
    const doc = await this.collection.findOne({ managerCi });
    return this._toEntity(doc);
  }

  /**
   * Encuentra todas las gasolineras
   * @returns {Promise<Array<GasStation>>} Lista de gasolineras
   */
  async findAll() {
    try {
      console.log('Buscando todas las gasolineras en la base de datos');
      const stationDocs = await this.collection.find({}).toArray();
      console.log(`Se encontraron ${stationDocs.length} gasolineras en la base de datos`);
      
      // Mapear los documentos a objetos de dominio
      return stationDocs.map(doc => this._mapToEntity(doc));
    } catch (error) {
      console.error('Error al buscar todas las gasolineras:', error);
      throw error;
    }
  }

  /**
   * Actualiza una gasolinera
   * @param {string} id - ID de la gasolinera
   * @param {Object} updateData - Datos a actualizar
   * @returns {Promise<boolean>} True si se actualizó correctamente
   */
  async update(id, updateData) {
    const updateDoc = {};
    
    // Procesar solo los campos permitidos
    if (updateData.name !== undefined) updateDoc.name = updateData.name;
    if (updateData.address !== undefined) updateDoc.address = updateData.address;
    
    // Convertir fechas si están presentes
    if (updateData.openTime !== undefined) {
      updateDoc.openTime = new Date(updateData.openTime);
    }
    
    if (updateData.closeTime !== undefined) {
      updateDoc.closeTime = new Date(updateData.closeTime);
    }
    
    // Si se incluye stationNumber, asegurar que sea entero
    if (updateData.stationNumber !== undefined) {
      updateDoc.stationNumber = parseInt(updateData.stationNumber);
    }

    // Actualizar nivel de combustible y disponibilidad
    if (updateData.currentLevel !== undefined) {
      updateDoc.currentLevel = parseFloat(updateData.currentLevel);
      updateDoc.available = parseFloat(updateData.currentLevel) > 0;
    }

    // Actualizar contador de tickets
    if (updateData.ticketCount !== undefined) {
      updateDoc.ticketCount = parseInt(updateData.ticketCount);
    }
    
    try {
      const result = await this.collection.updateOne(
        { _id: id },
        { $set: updateDoc }
      );
      return result.modifiedCount > 0;
    } catch (error) {
      console.error('Error al actualizar la gasolinera:', error);
      throw new Error('Error al actualizar la gasolinera: ' + error.message);
    }
  }

  /**
   * Incrementa el contador de tickets y actualiza el nivel de combustible
   * @param {string} id - ID de la gasolinera
   * @param {number} requestedLiters - Litros solicitados
   * @returns {Promise<boolean>} True si se actualizó correctamente
   */
  async incrementTicketCountAndUpdateFuel(id, requestedLiters) {
    try {
      const result = await this.collection.updateOne(
        { _id: id },
        { 
          $inc: { 
            ticketCount: 1,
            currentLevel: -requestedLiters // Reducir el nivel de combustible
          },
          $set: {
            available: { $cond: [{ $gte: ["$currentLevel", requestedLiters] }, true, false] }
          }
        }
      );
      return result.modifiedCount > 0;
    } catch (error) {
      console.error('Error al actualizar contador de tickets y combustible:', error);
      throw new Error('Error al actualizar la información de la gasolinera');
    }
  }
  
  /**
   * Actualiza el nivel de combustible y disponibilidad
   * @param {string} id - ID de la gasolinera
   * @param {number} newLevel - Nuevo nivel de combustible
   * @returns {Promise<boolean>} True si se actualizó correctamente
   */
  async updateFuelLevel(id, newLevel) {
    try {
      const result = await this.collection.updateOne(
        { _id: id },
        { 
          $set: { 
            currentLevel: parseFloat(newLevel),
            available: parseFloat(newLevel) > 0
          }
        }
      );
      return result.modifiedCount > 0;
    } catch (error) {
      console.error('Error al actualizar nivel de combustible:', error);
      throw new Error('Error al actualizar el nivel de combustible');
    }
  }

  /**
   * Elimina una gasolinera
   * @param {string} id - ID de la gasolinera
   * @returns {Promise<boolean>} True si se eliminó correctamente
   */
  async delete(id) {
    const result = await this.collection.deleteOne({ _id: id });
    return result.deletedCount > 0;
  }
}

module.exports = MongoGasStationRepository;
