# SP: pObtenerRowGuid
**Tipo**: Obtener
**Módulo**: General

## Tablas Referenciadas
- [`saHistoricoEstado`](../tables/saHistoricoEstado.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:				[pObtenerRowGuid]
DESCRIPCION:		OBTIENE TODOS LOS ROWGUID DE UNA TABLA DADA O EL ROWGUID DE UN REGISTRO EN ESPECIFICO DE DICHA TABLA
CREADO POR:			SOFTECH SISTEMAS
***************************************************************************************************************/	
CREATE PROCEDURE [dbo].[pObtenerRowGuid]
(
	@sdFechaDesde SMALLDATETIME,
	@sdFechaHasta SMALLDATETIME,
	@sDataBase_Name VARCHAR(50),
	@sNombreTabla VARCHAR (32),
	@sNombrePk1	 VARCHAR(15),
	@sNombrePk2	 VARCHAR(15)
)
AS
BEGIN
		DECLARE @SqlString		NVARCHAR(MAX)
		
		SET @SqlString = N'USE ' + CONVERT(NVARCHAR(30), @sDataBase_Name) + 'SELECT H.fecha, 
						  (CASE WHEN H.estado = "0" THEN "ACTIVO" ELSE "ANULADO" END) AS Estado,
						  A.' + CONVERT(VARCHAR(32), @sNombrePk1)  + ' (FROM saHistoricoEstado H INNER JOIN ' + CONVERT(VARCHAR(32), @sNombreTabla) 
						  + ' A ON H.doc_orig =  A.rowguid WHERE H.fecha <= ' +  CONVERT(VARCHAR(24), @sdFechaDesde, 113) 
						  + ' AND H.fecha >= ' +  CONVERT(VARCHAR(24), @sdFechaHasta, 113) +''''
						  


		EXEC sp_executesql @SQLString

END
```
