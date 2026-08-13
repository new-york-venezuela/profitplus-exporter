# SP: pSeleccionarHistoricoEstado
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)
- [`saChequera`](../tables/saChequera.md)
- [`saHistoricoEstado`](../tables/saHistoricoEstado.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:				[pSeleccionarHistoricoEstado]
DESCRIPCION:		FILTRA LOS REGISTROS DE LA TABLA saHistoricoEstado POR RANGO DE FECHA, TABLA Y CODIGO DE CLAVE PRIMARIA
CREADO POR:			SOFTECH SISTEMAS
***************************************************************************************************************/	
CREATE PROCEDURE [dbo].[pSeleccionarHistoricoEstado]
(
	@sNombreBaseDatos		VARCHAR(50),
	@sNombreTabla			VARCHAR (32),
	@sdFechaDesde			SMALLDATETIME,
	@sdFechaHasta			SMALLDATETIME,
	@sNombrePk1				VARCHAR(15),
	@sValorPk1				VARCHAR(20),
	@sValorPk2				CHAR(6)
)
AS
BEGIN
		IF (@sdFechaHasta IS NOT NULL) 
            SET @sdFechaHasta = DATEADD(ss, -60, DATEADD(day, 1, @sdFechaHasta)) 
		
		DECLARE @SqlString		NVARCHAR(MAX)

		IF (@sNombreTabla = 'saArticulo')
				SET @SqlString = N'USE ' + CONVERT(NVARCHAR(50), @sNombreBaseDatos) + ' SELECT H.fecha, 
						  (CASE WHEN H.estado = ''0'' THEN ''ACTIVO'' ELSE ''INACTIVO'' END) AS Estado,
						  A.' + CONVERT(VARCHAR(15), @sNombrePk1)  + ' AS PkTabla FROM saHistoricoEstado H INNER JOIN ' + CONVERT(VARCHAR(32), @sNombreTabla) 
						  + ' A ON H.doc_orig =  A.rowguid WHERE H.fecha >= @sdFechaDesde AND H.fecha <= @sdFechaHasta '

		ELSE IF (@sNombreTabla = 'saChequera')
				SET @SqlString = N'USE ' + CONVERT(NVARCHAR(50), @sNombreBaseDatos) + ' SELECT H.fecha, 
						  (CASE WHEN H.estado = ''SUS'' THEN ''SUSPENDIDA'' WHEN H.estado = ''USA'' THEN ''USADA'' 
								WHEN H.estado = ''INA'' THEN ''INACTIVA'' WHEN H.estado = ''ACT'' THEN ''ACTIVA'' END) AS Estado,
						  A.' + CONVERT(VARCHAR(15), @sNombrePk1)  + ' AS PkTabla FROM saHistoricoEstado H INNER JOIN ' + CONVERT(VARCHAR(32), @sNombreTabla) 
						  + ' A ON H.doc_orig =  A.rowguid WHERE H.fecha >= @sdFechaDesde AND H.fecha <= @sdFechaHasta '

		ELSE
				SET @SqlString = N'USE ' + CONVERT(NVARCHAR(50), @sNombreBaseDatos) + ' SELECT H.fecha, 
						  (CASE WHEN H.estado = ''0'' THEN ''ACTIVO'' ELSE ''ANULADO'' END) AS Estado,
						  A.' + CONVERT(VARCHAR(15), @sNombrePk1)  + ' AS PkTabla FROM saHistoricoEstado H INNER JOIN ' + CONVERT(VARCHAR(32), @sNombreTabla) 
						  + ' A ON H.doc_orig =  A.rowguid WHERE H.fecha >= @sdFechaDesde AND H.fecha <= @sdFechaHasta '

		IF (@sValorPk1 <> '')
			SET @SqlString = @SqlString + ' AND A.' + CONVERT(VARCHAR(15), @sNombrePk1) + ' = ''' + CONVERT(VARCHAR(20), @sV
```
