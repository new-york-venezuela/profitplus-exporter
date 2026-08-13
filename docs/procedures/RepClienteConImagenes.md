# SP: RepClienteConImagenes
**Tipo**: Reporte
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saDocumentoImagen`](../tables/saDocumentoImagen.md)
- [`saTipoCliente`](../tables/saTipoCliente.md)
- [`saTipoImagen`](../tables/saTipoImagen.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <26-11-14>
-- Description:	<Clientes con Imagenes>
-- =============================================
CREATE PROCEDURE [dbo].[RepClienteConImagenes]
	-- Add the parameters for the stored procedure here
    @sCo_Cli_d CHAR(16) = NULL ,
    @sCo_Cli_h CHAR(16) = NULL ,
    @sCo_Ven_d CHAR(6) = NULL ,
    @sCo_Ven_h CHAR(6) = NULL ,
    @sCo_Tipcli_d CHAR(6) = NULL ,
    @sCo_Tipcli_h CHAR(6) = NULL ,
    @sCo_Zon_d CHAR(6) = NULL ,
    @sCo_Zon_h CHAR(6) = NULL ,
    @sCo_Seg_d CHAR(6) = NULL ,
    @sCo_Seg_h CHAR(6) = NULL ,
    @sCo_Pais_d CHAR(6) = NULL ,
    @sCo_Pais_h CHAR(6) = NULL ,
    @sCo_Inactivo CHAR(2) = NULL ,
    @bCo_Inactivo_Filtro BIT = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0,
	@sCo_tipo_img_d char(6) = NULL,
	@sCo_tipo_img_h char(6) = NULL
AS 
    BEGIN
        SET NOCOUNT ON ;
	
        IF ( @sCo_Inactivo = 'SI' ) 
            SET @bCo_Inactivo_Filtro = 1
        IF ( @sCo_Inactivo = 'NO' ) 
            SET @bCo_Inactivo_Filtro = 0
	
        SELECT        C.co_cli, C.tip_cli, C.cli_des, C.telefonos, C.inactivo, C.co_zon, C.co_seg, C.rif, C.tipo_per, C.co_pais, C.rowguid,  
                         TC.des_tipo, TI.descrip, 
						 DI.co_tipo_imag, DI.rowguidDoc, DI.picture, DI.co_imag, DI.des_imag		
						 FROM            
                         dbo.saCliente AS C 
						 LEFT JOIN dbo.saTipoCliente AS TC ON TC.tip_cli = C.tip_cli						  
						 LEFT JOIN dbo.saDocumentoImagen as DI 
						 LEFT JOIN dbo.saTipoImagen as TI ON TI.co_tipo_imag = DI.co_tipo_imag ON DI.rowguidDoc = C.rowguid 
        WHERE
		DI.co_tipo_imag is not null and
            ( ( @sCo_Cli_d IS NULL
                OR C.co_cli >= @sCo_Cli_d
              )
              AND ( @sCo_Cli_h IS NULL
                    OR C.co_cli <= @sCo_Cli_h
                  )
            )
            AND ( ( @sCo_Ven_d IS NULL
                    OR C.co_ven >= @sCo_Ven_d
                  )
                  AND ( @sCo_Ven_h IS NULL
                        OR C.co_ven <= @sCo_Ven_h
                      )
                )
            AND ( ( @sCo_Tipcli_d IS NULL
                    OR C.tip_cli >= @sCo_Tipcli_d
                  )
                  AND ( @sCo_Tipcli_h IS NULL
                        OR C.tip_cli <= @sCo_Tipcli_h
```
