# SP: pInsertarDocumentoElectronicoLog
**Tipo**: Insertar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saDocumentoElectronico`](../tables/saDocumentoElectronico.md)

## Código (excerpt)
```sql
-- =============================================
-- NOMBRE:		pInsertarDocumentoElectronicoLog
-- DESCRIPCIÓN: Inserta los log de los documentos electrónicos
-- AUTOR:		SOFTECH SISTEMAS
-- =============================================
CREATE PROCEDURE [dbo].[pInsertarDocumentoElectronicoLog]
	(
	  @sco_doc_elec CHAR(20),
	  @stipo_documento CHAR(100),
	  @sdocnum CHAR(20) = NULL,
	  @bgenerado BIT,
	  @sgeneradoerror VARCHAR(MAX) = NULL,
	  @benviado BIT,
	  @senviadoerror VARCHAR(MAX) = NULL,
	  @scorreo VARCHAR(MAX),
	  @sruta VARCHAR(MAX),
	  @sCo_us_in CHAR(6),
	  @sdFec_in SMALLDATETIME = NULL,
      @sCo_sucu_in CHAR(6),
	   @sMaquina VARCHAR(60) = NULL
	 
	)
AS
	BEGIN


DECLARE @sTipoDocumento NVARCHAR(100)
select @sTipoDocumento = RTRIM(@stipo_documento)
-- Encontrar la posición del guion
DECLARE @posicionGuion INT = CHARINDEX('-', @sTipoDocumento);
DECLARE @TipoDocEnviado NVARCHAR(100) = RIGHT(@sTipoDocumento, LEN(@sTipoDocumento) - @posicionGuion);
set @stipo_documento  = LEFT(@sTipoDocumento, @posicionGuion - 1);



		DECLARE @myDoc xml; 
	DECLARE @datosXml varchar(4000);
		DECLARE @rowGuidOri  UNIQUEIDENTIFIER;
		Declare @sTipoDocEnviado CHAR(20);


	select @myDoc = log from saDocumentoElectronico where co_doc_elec = @sco_doc_elec AND tipo_documento = @stipo_documento
	if @myDoc is null
	begin

		update saDocumentoElectronico set log = '<Log>
		 <General servidor = "" correoenvio= "" rutacarpeta = ""  />
		 </Log>'  where co_doc_elec = @sco_doc_elec AND tipo_documento = @stipo_documento

	end	
	
	set @datosXml = '
			<Generacion NumDoc = "'+ @sdocnum +'" generado = "'+ str(@bgenerado) +'" generadoerror = "'+ @sgeneradoerror +'" enviado = "'+str(@benviado) +'" enviadoerror = "'+ @senviadoerror +'" correo = "'+ @scorreo +'" ruta = "'+ @sruta +'"/>
	'
	 DECLARE @cad nvarchar(4000);
	SET @cad = 'DECLARE @myDoc xml; 
   select @myDoc = log from saDocumentoElectronico where co_doc_elec = ''' +@sco_doc_elec+''' AND tipo_documento = ''' +@stipo_documento+'''
	set @myDoc.modify(''insert ' + @datosXml + '  into  (/Log)[1]'');
	update saDocumentoElectronico set log = @myDoc  where co_doc_elec = ''' + @sco_doc_elec + ''' AND tipo_documento = ''' +@stipo_documento+'''

	';

	EXEC sp_executesql @query = @cad


	DECLARE @rowguidResult UNIQUEIDENTIFIER;
	DECLARE @sql NVARCHAR(MAX)             -- SQL dinámico

	IF @TipoDocEnviado <> 'saDocumentoCompra'
	BEGIN
		-- Construcción del SQL dinámico
```
