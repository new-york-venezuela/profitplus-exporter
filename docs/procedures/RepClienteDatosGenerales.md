# SP: RepClienteDatosGenerales
**Tipo**: Reporte
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saCondicionPago`](../tables/saCondicionPago.md)
- [`saPais`](../tables/saPais.md)
- [`saSegmento`](../tables/saSegmento.md)
- [`saTipoCliente`](../tables/saTipoCliente.md)
- [`saZona`](../tables/saZona.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <20-07-10>
-- Description:	<Clientes con Datos Básicos>
-- =============================================
CREATE PROCEDURE [dbo].[RepClienteDatosGenerales]
	-- Add the parameters for the stored procedure here
    @sCo_Cli_d CHAR(16) = NULL ,
    @sCo_Cli_h CHAR(16) = NULL ,
	@sCo_Tipcli_d CHAR(6) = NULL ,
    @sCo_Tipcli_h CHAR(6) = NULL ,
	@sCo_Zon_d CHAR(6) = NULL ,
    @sCo_Zon_h CHAR(6) = NULL ,
	@sCo_Seg_d CHAR(6) = NULL ,
    @sCo_Seg_h CHAR(6) = NULL ,
	@sCond_Pago_d  CHAR(6) = NULL ,
	@sCond_Pago_h  CHAR(6) = NULL ,
	@sCo_Inactivo CHAR(2) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
	declare @bCo_Inactivo_Filtro BIT = NULL 


        IF ( @sCo_Inactivo = 'SI' ) 
            SET @bCo_Inactivo_Filtro = 1
        IF ( @sCo_Inactivo = 'NO' ) 
            SET @bCo_Inactivo_Filtro = 0
	
        SELECT
            C.*, TC.des_tipo,
			CASE WHEN C.tipo_per = '1' THEN ' Natural Residente' 
			      WHEN C.tipo_per = '2' THEN 'Natural No Residente'
				   WHEN C.tipo_per = '3' THEN 'Juridica Domiciliada'
				    WHEN C.tipo_per = '4' THEN 'Juridica No Domiciliada'
					 WHEN C.tipo_per = '5' THEN 'Exenta'
					  WHEN C.tipo_per = '6' THEN 'Tesoreria Nacional'
					  WHEN C.tipo_per = '7' THEN 'Otros'
					   WHEN C.tipo_per = '8' THEN 'Otros 2'
					   END as Tipo_Persona, 
					   CP.cond_des, TP.des_tipo, Z.zon_des, P.pais_des,
					   CASE WHEN C.contribu_e = 1 THEN 'SI'
					   ELSE 'NO' END as des_contribu_e ,

					    CASE WHEN C.inactivo = 1 THEN 'SI'
					   ELSE 'NO' END as des_inactivo , SEG.seg_des
					   
        FROM
            saCliente AS C
            INNER JOIN saTipoCliente AS TC ON TC.tip_cli = C.tip_cli
			INNER JOIN saCondicionPago as CP ON C.cond_pag = CP.co_cond
			INNER JOIN saTipoCliente as TP ON C.tip_cli = TP.tip_cli
			INNER JOIN saZona as Z ON C.co_zon = Z.co_zon
			INNER JOIN saSegmento as SEG on C.co_seg = SEG.co_seg
			INNER JOIN saPais as P ON C.co_pais = P.co_pais
			
			WHERE
            ( ( @sCo_Cli_d IS NULL
                OR C.co_cli >= @sCo_Cli_d
              )
              AND ( @sCo_Cli_h IS NULL
                    OR C.co_cli <= @sCo_Cli_h
                  )
            )
           
            AND ( ( @sCo_Tipcli_d IS NULL
                    OR C.tip_cl
```
