# SP: RepProveedorDatosGenerales
**Tipo**: Reporte
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCondicionPago`](../tables/saCondicionPago.md)
- [`saPais`](../tables/saPais.md)
- [`saProveedor`](../tables/saProveedor.md)
- [`saSegmento`](../tables/saSegmento.md)
- [`saTipoProveedor`](../tables/saTipoProveedor.md)
- [`saZona`](../tables/saZona.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <20-07-10>
-- Description:	<Proveedores con Datos Básicos>
-- =============================================
CREATE PROCEDURE [dbo].[RepProveedorDatosGenerales]
	-- Add the parameters for the stored procedure here
    @sCo_Prov_d CHAR(16) = NULL ,
    @sCo_Prov_h CHAR(16) = NULL ,
    @sCo_TipPro_d CHAR(6) = NULL ,
    @sCo_TipPro_h CHAR(6) = NULL ,
    @sCo_Zon_d CHAR(6) = NULL ,
    @sCo_Zon_h CHAR(6) = NULL ,
    @sCo_Seg_d CHAR(6) = NULL ,
    @sCo_Seg_h CHAR(6) = NULL ,
	@sCond_Pago_d  CHAR(6) = NULL ,
	@sCond_Pago_h  CHAR(6) = NULL ,
    @sCo_Inactivo CHAR(2) = NULL ,
    @bCo_Inactivo_Filtro BIT = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0

AS 
    BEGIN
        SET NOCOUNT ON ;

        IF ( @sCo_Inactivo = 'SI' ) 
            SET @bCo_Inactivo_Filtro = 1
        IF ( @sCo_Inactivo = 'NO' ) 
            SET @bCo_Inactivo_Filtro = 0


        SELECT
            P.*, TP.des_tipo,
			CASE WHEN P.tipo_per = '1' THEN ' Natural Residente' 
			      WHEN P.tipo_per = '2' THEN 'Natural No Residente'
				   WHEN P.tipo_per = '3' THEN 'Juridica Domiciliada'
				    WHEN P.tipo_per = '4' THEN 'Juridica No Domiciliada'
					 WHEN P.tipo_per = '5' THEN 'Exenta'
					  WHEN P.tipo_per = '6' THEN 'Tesoreria Nacional'
					  WHEN P.tipo_per = '7' THEN 'Otros'
					   WHEN P.tipo_per = '8' THEN 'Otros 2'
					   END as Tipo_Persona, 
					   CP.cond_des, TPP.des_tipo, Z.zon_des, PS.pais_des,
					   CASE WHEN P.nacional = 1 THEN 'SI'
					   ELSE 'NO' END as des_contribu_e ,

					    CASE WHEN P.inactivo = 1 THEN 'SI'
					   ELSE 'NO' END as des_inactivo , SEG.seg_des
        FROM
            saProveedor AS P
            INNER JOIN saTipoProveedor AS TP ON TP.tip_pro = P.tip_pro
			INNER JOIN saCondicionPago as CP ON P.cond_pag = CP.co_cond
			INNER JOIN saTipoProveedor as TPP ON P.tip_pro = TPP.tip_pro
			INNER JOIN saZona as Z ON P.co_zon = Z.co_zon
			INNER JOIN saSegmento as SEG on P.co_seg = SEG.co_seg
			INNER JOIN saPais as PS ON P.co_pais = PS.co_pais
        WHERE
            ( ( @sCo_Prov_d IS NULL
                OR P.co_prov >= @sCo_Prov_d
              )
              AND ( @sCo_Prov_h IS NULL
                    OR P.co_prov <= @sCo_Prov_h
                  )
            )
            AND ( ( @sCo_TipP
```
