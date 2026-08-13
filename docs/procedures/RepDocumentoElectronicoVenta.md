# SP: RepDocumentoElectronicoVenta
**Tipo**: Reporte
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saDocumentoElectronico`](../tables/saDocumentoElectronico.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <30/11/2015>
-- Description:	<RepDocumentoElectronicoVenta>
-- =============================================
CREATE PROCEDURE [dbo].[RepDocumentoElectronicoVenta]
	-- Add the parameters for the stored procedure here
    @cCo_doc_elec_d CHAR(20) = NULL ,
    @cCo_doc_elec_h CHAR(20) = NULL ,    
    @dFecha_d DATETIME = NULL ,
    @dFecha_h DATETIME = NULL ,
    @cCo_grupo_rep_d CHAR(6) = NULL ,
    @cCo_grupo_rep_h CHAR(6) = NULL ,
    @cProcesado CHAR(6) = NULL ,
	@sNombreDBMaestra VARCHAR(max),
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

		DECLARE @query1 NVARCHAR(max)
        SET @query1 = 'select co_grupo, descripcion, tipo_reporte, producto from '+ @sNombreDBMaestra +'.[dbo].[MpGrupos_Rep] Where producto = ''ADMI''' 
		
		DECLARE @TablaFijos1 TABLE
					(              
						co_grupo char(6),
						descripcion varchar(60),
						tipo_reporte char(10),
						producto char(6)
					)
		INSERT INTO
		@TablaFijos1
		EXEC sp_executesql @query1

		DECLARE @query2 NVARCHAR(max)
        SET @query2 = 'select co_reporte, des_reporte, co_grupo, producto from '+ @sNombreDBMaestra +'.[dbo].[MpReporte] Where producto = ''ADMI''' 
		
		DECLARE @TablaFijos2 TABLE
					(              
						co_reporte char(6),
						des_reporte varchar(128),
						co_grupo char(6),
						producto char(6)
					)
		INSERT INTO
		@TablaFijos2
		EXEC sp_executesql @query2


		IF ( @cProcesado IS NULL ) 
            SET @cProcesado = 'TODO'
		        
        SELECT
            DE.co_doc_elec, DE.des_doc_elec, DE.fec_doc_elec, DE.co_grupo_rep, (select TOP(1)descripcion from @TablaFijos1 where co_grupo = DE.co_grupo_rep)
			as descrip_grupo_rep, DE.co_reporte, (select TOP(1)des_reporte from @TablaFijos2 where co_reporte = DE.co_reporte) as descrip_reporte,
			DE.sp_doc_elec, DE.doc_num_desde, DE.doc_num_hasta, DE.fec_emis_desde, DE.fec_emis_hasta, DE.fec_venc_desde, DE.co_cli_desde,
			CL1.cli_des as cli_des_desde, DE.co_cli_hasta, CL2.cli_des as cli_des_hasta, DE.procesado
        FROM
            saDocumentoElectronico DE
			LEFT JOIN saCliente CL1 ON DE.co_cli_desde = CL1.co_cli
			LEFT JOIN saCliente CL2 ON DE.co_cli_hasta = CL2.co_cli
            
        WHERE						
            ((@cCo_doc_elec_d IS NULL OR DE.co_doc_elec >= @cCo_doc_elec_d
```
