# SP: pObtenerDocumentoElectronicoLog
**Tipo**: Obtener
**Módulo**: General

## Tablas Referenciadas
- [`saDocumentoElectronico`](../tables/saDocumentoElectronico.md)

## Código (excerpt)
```sql
-- =============================================
-- NOMBRE:		pObtenerDocumentoElectronicoLog
-- DESCRIPCIÓN: Obtener el log de los documentos electrónicos 
-- AUTOR:		SOFTECH SISTEMAS
-- =============================================
CREATE PROCEDURE [dbo].[pObtenerDocumentoElectronicoLog]
	(	  
	  @sCo_doc_elec CHAR(20),	  
	  @sTipo_documento CHAR(10)
	)
AS
	BEGIN
		
		DECLARE @myDoc xml
		DECLARE @resultado xml
		DECLARE @idoc int
		DECLARE @ProdID varchar(128)

		select top 1 @myDoc = log from saDocumentoElectronico where co_doc_elec = @sco_doc_elec AND tipo_documento = @stipo_documento

		EXEC sp_xml_preparedocument @idoc OUTPUT, @myDoc;


		set @resultado = (select correo, CASE WHEN (generado = 1) THEN 'SI' ELSE 'NO' END as generado, generadoerror, CASE WHEN (enviado = 1) THEN 'SI' ELSE 'NO' END as enviado, enviadoerror, ruta, NumDoc   from (SELECT    *
		FROM       OPENXML (@idoc, '/Log/Generacion')
					WITH   (correo  varchar(max),
							generado  bit,
							generadoerror  varchar(max),
							enviado  bit,
							enviadoerror  varchar(max),
							ruta  varchar(max),
						    NumDoc CHAR(20))) Registros

						  FOR XML RAW, ROOT('Registros') ) 

		set @resultado.modify('insert <Definiciones>
		<Def campo="correo" nombre="Correo" largo="128" posicion="3"/>
		<Def campo="generado" nombre="Generado" largo="20" posicion="4"/>
		<Def campo="generadoerror" nombre="Error Gen." largo="128" posicion="5"/>
		<Def campo="enviado" nombre="Enviado" largo="20" posicion="6"/>
		<Def campo="enviadoerror" nombre="Error Env." largo="128" posicion="7"/>
		<Def campo="ruta" nombre="Ruta Arch." largo="200" posicion="8" />
		<Def campo="NumDoc" nombre="N° Documento" largo="64" posicion="2"/>
		<Def campo="status" nombre="Status" largo="20" posicion="1"/>
		</Definiciones> as first  into (/Registros)[1] ')

		select @resultado as [Log]
	

	END
```
