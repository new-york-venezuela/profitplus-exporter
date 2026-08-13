# SP: RepGiroVentaConImagenes
**Tipo**: Reporte
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saDocumentoImagen`](../tables/saDocumentoImagen.md)
- [`saGiroVenta`](../tables/saGiroVenta.md)
- [`saTipoImagen`](../tables/saTipoImagen.md)
- [`saVendedor`](../tables/saVendedor.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <30/11/2015>
-- Description:	<Giro de Venta Con Imagenes>
-- =============================================
CREATE PROCEDURE [dbo].[RepGiroVentaConImagenes]
	-- Add the parameters for the stored procedure here
    @sCo_giro_d CHAR(20) = NULL ,
    @sCo_giro_h CHAR(20) = NULL ,    
    @dFecha_d DATETIME = NULL ,
    @dFecha_h DATETIME = NULL ,
    @sCo_cli_d CHAR(16) = NULL ,
    @sCo_cli_h CHAR(16) = NULL ,
    @sCo_ven_d CHAR(6) = NULL ,
    @sCo_ven_h CHAR(6) = NULL ,
    @sCo_tipo_img_d char(6) = NULL,
	@sCo_tipo_img_h char(6) = NULL,    
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
		        
        SELECT
            GV.co_giro, GV.des_giro, GV.co_cli, Cl.cli_des, dbo.fechasimple(GV.fecha) AS fecha, GV.co_ven, VE.ven_des,
			DI.co_imag, DI.des_imag, DI.picture, DI.co_tipo_imag, TI.descrip AS descripImagen
        FROM
            saGiroVenta AS GV
            LEFT JOIN saCliente AS CL ON CL.co_cli = GV.co_cli
			LEFT JOIN saVendedor as VE ON GV.co_ven = VE.co_ven            
			left outer join saDocumentoImagen DI ON GV.rowguid = DI.rowguidDoc
			INNER JOIN saTipoImagen TI ON DI.co_tipo_imag = TI.co_tipo_imag
        WHERE			
			DI.co_imag IS NOT NULL AND
            ((@sCo_giro_d IS NULL OR GV.co_giro >= @sCo_giro_d) AND (@sCo_giro_h IS NULL OR GV.co_giro <= @sCo_giro_h)) AND
			((@dFecha_d IS NULL OR dbo.fechasimple(GV.fecha) >= @dFecha_d) AND (@dFecha_h IS NULL OR dbo.fechasimple(GV.fecha) <= @dFecha_h)) AND 
			((@sCo_cli_d IS NULL OR GV.co_cli >= @sCo_cli_d) AND (@sCo_cli_h IS NULL OR GV.co_cli <= @sCo_cli_h)) AND
			((@sCo_ven_d IS NULL OR GV.co_ven >= @sCo_Ven_d) AND (@sCo_Ven_h IS NULL OR GV.co_ven <= @sCo_Ven_h)) AND
			((@sCo_tipo_img_d IS NULL OR TI.co_tipo_imag >= @sCo_tipo_img_d) AND (@sCo_tipo_img_h IS NULL OR TI.co_tipo_imag <= @sCo_tipo_img_h))
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'des_giro' THEN GV.des_giro
                                 ELSE GV.co_giro
                               END
            END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                          WHEN 'des_giro' THEN GV.des_giro
                                          ELSE GV.co_giro
```
