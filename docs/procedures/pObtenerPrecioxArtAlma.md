# SP: pObtenerPrecioxArtAlma
**Tipo**: Obtener
**Módulo**: General

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pObtenerPrecioxArtAlma]
DESCRIPCION: Se encarga de obtener el saldo de 
CREADO POR: SOFTECH SISTEMAS
MODIFICADO POR: 
MODIFICADO EL: 14/05/2010
***************************************************************************************************************/
CREATE PROCEDURE [pObtenerPrecioxArtAlma]
    (
      @strCo_Art CHAR(30) ,
      @dtFecha SMALLDATETIME = NULL ,
      @strCo_Precio CHAR(6) ,
      @strCo_Alma CHAR(6) = NULL ,
      @strCo_MoneBase CHAR(6) = NULL , -- Codigo de la moneda en que esta el precio, si pasan vacio toma la de par_emp
      @bConImpuesto BIT ,
      @intNumImpuesto INTEGER = 1 ,
      @sCod_Uni CHAR(6) = NULL
	
    )
AS 
    BEGIN		
        SELECT
            ISNULL(dbo.PrecioAUnaFecha(@strCo_Art, @dtFecha, @strCo_Precio, @strCo_Alma, @strCo_MoneBase, @bConImpuesto,
                                       @intNumImpuesto, @sCod_Uni), 0) AS precio
    END
```
