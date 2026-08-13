# SP: pInsertarRenglonesPrecioArticulo
**Tipo**: Insertar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtPrecio`](../tables/saArtPrecio.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE                    : pInsertarRenglonesPrecioArticulo
*DESCRIPCIÓN : Inserta un Precio
*AUTOR              : SOFTECH SISTEMAS
*************************************************************************/

CREATE PROCEDURE [dbo].[pInsertarRenglonesPrecioArticulo]
    (
      @iRENG_NUM INT ,
      @sCo_Art CHAR(30) ,
      @sCo_Precio CHAR(6) ,
      @dDesde DATETIME ,
      @sCo_Alma CHAR(6) ,
      @dHasta DATETIME = NULL ,
      @deMonto DECIMAL(18, 5) ,
      @bPrecioOm BIT ,
      @deMargenMin DECIMAL(18, 5) = NULL ,
      @deMargenMax DECIMAL(18, 5) = NULL ,
      @deMargenMinV DECIMAL(18, 5) = NULL ,
      @sco_mone CHAR(6) = NULL,
      @binactivo BIT = NULL,
      @sCo_Us_In CHAR(6) ,
      @sCo_Sucu_In CHAR(6) ,
      @sMaquina VARCHAR(60) = NULL ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1)
    )
AS 
    BEGIN

        IF @sCo_Alma = 'TODOS'
            OR @sCo_Alma = '' 
            BEGIN
                SET @sCo_Alma = NULL 
            END

        DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )
		
		
        INSERT  INTO saArtPrecio
                ( co_art, co_precio, desde, co_alma, hasta, monto, precioOm, Co_Mone, Inactivo, co_us_in, co_sucu_in, fe_us_in, co_us_mo,
                  co_sucu_mo, fe_us_mo, revisado, trasnfe )
        OUTPUT  Inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sCo_Art, @sCo_Precio, @dDesde, @sCo_Alma, @dHasta, @deMonto, @bPrecioOm, @sCo_Mone, @bInactivo, @sCo_Us_In, @sCo_Sucu_In,
                  GETDATE(), @sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sRevisado, @sTrasnfe )

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER
        DECLARE @sCamposI NVARCHAR(70)

        SET @sCamposI = @sCo_Art + ', ' + @sCo_Precio + ', ' + CONVERT(NVARCHAR(10), @dDesde, 103) + ', ' + @sCo_Alma
		
        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

		-- Insertar Pista
        EXEC pInsertarPista @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'saArtPrecio', @rowguidOri = @rowGuidOri, @sTipo_Op =
```
